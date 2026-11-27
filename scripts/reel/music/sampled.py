"""Real sampled instruments for a song: recorded voices and orchestra, played from the song's own note lists.

A part's notes are written to a small MIDI file, FluidSynth plays it through a General MIDI sound bank, and the
audio comes back as an array to mix with the song's computed voices. The rest of the music here is computed sample by
sample (synth.py); only a song that says so in its docstring uses this.

Needs FluidSynth and a sound bank:
  apt-get install fluidsynth fluid-soundfont-gm
The bank is FluidR3_GM.sf2 (Frank Wen; MIT license: /usr/share/doc/fluid-soundfont-gm/copyright). It is not in the
repo (148 MB). SOUND_BANK in the environment names another one. A game file made with it credits it (CREDITS.md).
"""
import functools
import os
import subprocess
import tempfile

import numpy as np

from synth import SR

BANK = os.environ.get("SOUND_BANK", "/usr/share/sounds/sf2/FluidR3_GM.sf2")
TICKS = 1920  # MIDI ticks a second: 960 to the quarter note at 120
# The bank's presets used so far (General MIDI numbers).
CHOIR_AAH, VOICE_OOH, SOLO_VOX = 52, 53, 85
STRINGS, SLOW_STRINGS, TREMOLO, VIOLIN, CELLO = 48, 49, 44, 40, 42
FLUTE, OBOE, ORGAN, TIMPANI = 73, 68, 19, 47
CHURCH_BELL = 14  # in bank 8


def _var(n: int) -> bytes:
    """A MIDI file's variable-length number."""
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(out))


def _curve(points, step):
    """[(seconds, value)] -> (seconds, value) every `step` seconds, straight lines between the points."""
    points = sorted(points)
    ts = np.arange(points[0][0], points[-1][0] + step / 2, step)
    return zip(ts, np.interp(ts, [p[0] for p in points], [p[1] for p in points]))


@functools.lru_cache(maxsize=None)
def off_pitch(program: int, m: int, bank: int = 0) -> float:
    """How far off the bank plays a note, in cents (minus: flat). Its choir and strings are real groups, recorded a
    little under the note in places (the men's "aah" as much as 29 cents): fine alone, sour against computed voices.
    Measured on the note held: where the energy sits round each of its first six overtones."""
    x = stem([(0.1, 2.4, m, 100)], program, 2.5, tail=0.1, bank=bank).mean(axis=0)
    seg = x[int(0.9 * SR) : int(2.4 * SR)]
    size = 1 << 19
    power = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), size)) ** 2
    f = np.fft.rfftfreq(size, 1 / SR)
    f0 = 440.0 * 2 ** ((m - 69) / 12)
    total, weight = 0.0, 0.0
    for h in range(1, 7):
        if h * f0 > 5000:
            break
        band = (f > h * f0 * 2 ** (-55 / 1200)) & (f < h * f0 * 2 ** (55 / 1200))
        p = power[band]
        total += float(np.sum(p * 1200 * np.log2(f[band] / (h * f0))))
        weight += float(np.sum(p))
    return total / weight if weight else 0.0


def stem(notes, program, secs, swell=None, bend=None, tail=6.0, bank=0, bend_range=2.0, tune=False) -> np.ndarray:
    """One instrument alone, dry: (2, n) from 0 s to `secs` + `tail`.
    `notes`: (start seconds, length seconds, MIDI note, loudness 1-127). `swell`: [(seconds, 0-127)], the player's
    expression (MIDI controller 11), straight lines between the points. `bend`: [(seconds, half steps)], the pitch
    bent (for one line: a slide, a vibrato), at most `bend_range` half steps either way. `tune`: each note is put
    right by what `off_pitch` measures (notes that need the same nudge share a MIDI channel and its pitch bend)."""
    step = 3
    while True:  # the nudges, rounded until there are no more of them than channels (15: the tenth is the drums')
        fix = {m: (step * round(float(np.clip(-off_pitch(program, m, bank), -45, 45)) / step) if tune else 0) for m in {int(note[2]) for note in notes}}
        nudges = sorted(set(fix.values())) or [0]
        if len(nudges) <= 15:
            break
        step += 2
    chan = {cents: (i if i < 9 else i + 1) for i, cents in enumerate(nudges)}
    ev = []
    for cents, c in chan.items():
        ev += [(0, 0, bytes([0xB0 | c, 0, bank])), (0, 1, bytes([0xC0 | c, program])), (0, 2, bytes([0xB0 | c, 7, 127])), (0, 2, bytes([0xB0 | c, 10, 64])),
               (0, 2, bytes([0xB0 | c, 91, 0])), (0, 2, bytes([0xB0 | c, 93, 0])), (0, 2, bytes([0xB0 | c, 11, 127])),
               (0, 2, bytes([0xB0 | c, 101, 0])), (0, 3, bytes([0xB0 | c, 100, 0])), (0, 4, bytes([0xB0 | c, 6, int(bend_range)])), (0, 5, bytes([0xB0 | c, 38, 0]))]
        last = None
        for t, v in _curve(bend, 0.004) if bend else ((0.0, 0.0),):
            v = int(np.clip(round(8192 + (v + cents / 100) / bend_range * 8191), 0, 16383))
            if v != last:
                ev.append((int(round(t * TICKS)), 15, bytes([0xE0 | c, v & 0x7F, v >> 7])))
                last = v
        last = None
        for t, v in _curve(swell, 0.01) if swell else ():
            v = int(np.clip(round(v), 0, 127))
            if v != last:
                ev.append((int(round(t * TICKS)), 15, bytes([0xB0 | c, 11, v])))
                last = v
    for start, length, m, loud in notes:
        c = chan[fix[int(m)]]
        ev.append((int(round(start * TICKS)), 20, bytes([0x90 | c, int(m), int(np.clip(loud, 1, 127))])))
        ev.append((int(round((start + length) * TICKS)), 10, bytes([0x80 | c, int(m), 0])))
    ev.sort(key=lambda e: (e[0], e[1]))
    track, now = bytearray(b"\x00\xff\x51\x03\x07\xa1\x20"), 0  # the tempo: 500000 microseconds a quarter note
    for tick, _, data in ev:
        track += _var(tick - now) + data
        now = tick
    track += _var(max(0, int(round((secs + tail) * TICKS)) - now)) + b"\xff\x2f\x00"
    with tempfile.TemporaryDirectory() as tmp:
        with open(f"{tmp}/part.mid", "wb") as f:
            f.write(b"MThd" + (6).to_bytes(4, "big") + (0).to_bytes(2, "big") + (1).to_bytes(2, "big") + (960).to_bytes(2, "big"))
            f.write(b"MTrk" + len(track).to_bytes(4, "big") + bytes(track))
        subprocess.run(["fluidsynth", "-ni", "-q", "-g", "1.0", "-R", "0", "-C", "0", "-r", str(SR), "-o", "synth.polyphony=512",
                        "-T", "raw", "-O", "float", "-E", "little", "-F", f"{tmp}/part.raw", BANK, f"{tmp}/part.mid"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        x = np.fromfile(f"{tmp}/part.raw", dtype="<f4").reshape(-1, 2).T.astype(np.float64)
    want = int(round((secs + tail) * SR))
    return np.pad(x, ((0, 0), (0, max(0, want - x.shape[1]))))[:, :want]


def wrap(x: np.ndarray, n: int) -> np.ndarray:
    """A stem folded onto a loop of `n` samples: what rings past the end comes round to the start."""
    out = np.zeros((2, n))
    for i in range(0, x.shape[1], n):
        part = x[:, i : i + n]
        out[:, : part.shape[1]] += part
    return out


def hall(x: np.ndarray, secs=3.5, wet=0.4, seed=11, dark=4500.0) -> np.ndarray:
    """A looped stem in a stone hall: itself, and `wet` of it through `secs` of dying noise (round the loop point)."""
    n = x.shape[1]
    k = int(secs * SR)
    t = np.arange(k) / SR
    ir = np.zeros((2, n))
    ir[:, :k] = np.random.default_rng(seed).normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.03)
    ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
    f = np.fft.rfftfreq(n, 1 / SR)
    return x + wet * np.fft.irfft(np.fft.rfft(x, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / dark) ** 2) * (f > 150), n=n, axis=1)
