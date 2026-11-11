"""Track 1, the chiptune: every sample made here from pulse, triangle and noise voices (no samples, no files), the way
packages/app/src/characters/synth.ts makes the bosses' sounds. Everything is written into a circular buffer the length
of the reel, so the loop is seamless by construction.
  python3 chip.py <out.wav> [reel seconds]
"""
import sys
import wave

import numpy as np

import score as S

SR = 48000
OS = 4  # oversampling: pulse waves are drawn at 192 kHz and averaged down, which keeps the aliasing quiet


def main(out: str, reel_s: float) -> None:
    N = int(round(reel_s * SR)) * OS
    sr = SR * OS
    beat_s = reel_s / S.BEATS
    rng = np.random.default_rng(7)
    buses = {k: np.zeros((2, N)) for k in ("lead", "arp", "bass", "drum", "dark")}

    def put(bus: str, beat: float, x: np.ndarray, pan: float = 0.0) -> None:
        i0 = int(round((S.OFFSET_S + beat * beat_s) * sr))
        idx = (i0 + np.arange(len(x))) % N
        np.add.at(buses[bus][0], idx, x * (1 - max(0, pan)))
        np.add.at(buses[bus][1], idx, x * (1 + min(0, pan)))

    def hz(m: float) -> float:
        return 440.0 * 2 ** ((m - 69) / 12)

    def env(k: int, attack=0.003, decay=0.09, sustain=0.6, release=0.02) -> np.ndarray:
        t = np.arange(k) / sr
        e = sustain + (1 - sustain) * np.exp(-t / decay)
        e *= np.minimum(1, t / attack)
        e *= np.minimum(1, (k - 1 - np.arange(k)) / (release * sr))
        return e

    def pulse(m, beats, duty=0.5, vol=0.2, vib=0.0, bend=None, **kw) -> np.ndarray:
        k = max(int(beats * beat_s * sr), 64)
        t = np.arange(k) / sr
        f = np.full(k, hz(m))
        if vib:
            f *= 1 + vib * np.sin(2 * np.pi * 6 * t) * np.clip((t - 0.12) / 0.15, 0, 1)
        if bend is not None:
            f *= 2 ** (np.linspace(bend[0], bend[1], k) / 12)
        ph = np.cumsum(f) / sr
        return np.where(ph % 1 < duty, 1.0, -1.0) * env(k, **kw) * vol

    def tri(m, beats, vol=0.3, bend=None, **kw) -> np.ndarray:
        k = max(int(beats * beat_s * sr), 64)
        f = np.full(k, hz(m))
        if bend is not None:
            f *= 2 ** (np.linspace(bend[0], bend[1], k) / 12)
        ph = (np.cumsum(f) / sr) % 1
        w = np.round((4 * np.abs(ph - 0.5) - 1) * 7.5) / 7.5  # 16 steps, like the old consoles' triangle
        kw.setdefault("sustain", 1.0)
        return w * env(k, **kw) * vol

    def noise(secs, rate, vol=0.2, decay=0.08, attack=0.001) -> np.ndarray:
        k = int(secs * sr)
        hold = max(1, int(sr / rate))
        w = np.repeat(rng.uniform(-1, 1, k // hold + 1), hold)[:k]
        t = np.arange(k) / sr
        return w * np.exp(-t / decay) * np.minimum(1, t / attack) * vol * np.minimum(1, (k - 1 - np.arange(k)) / (0.004 * sr))

    def kick(beat, vol=0.5):
        put("drum", beat, tri(52, 0.14 / beat_s, vol, bend=(18, -14), decay=0.05, sustain=0.0))

    def snare(beat, vol=0.22):
        put("drum", beat, noise(0.16, 9000, vol, 0.05))
        put("drum", beat, tri(57, 0.05 / beat_s, vol * 0.6, bend=(4, -6), sustain=0.0, decay=0.02))

    def hat(beat, vol=0.07):
        put("drum", beat, noise(0.04, 24000, vol, 0.012), 0.3)

    def crash(beat, vol=0.3, decay=0.45):
        put("drum", beat, noise(1.6, 16000, vol, decay))

    def lead(notes, duty=0.5, vol=0.2, gate=0.92, vib=0.006, octave=None):
        for b, d, m in notes:
            put("lead", b, pulse(m, d * gate, duty, vol, vib if d >= 0.75 else 0))
            if octave is not None:
                put("lead", b, pulse(m + octave, d * gate, 0.125, vol * 0.4))

    def arp(a, b, step=0.25, vol=0.07, up=12):
        """The chord as a quick broken run, the classic way to fake harmony with one voice."""
        t, i = a, 0
        while t < b - 1e-6:
            notes, _ = S.chord_at(t)
            put("arp", t, pulse(notes[i % 3] + up * ((i // 3) % 2), step * 0.9, 0.25, vol, decay=0.05, sustain=0.4), -0.5 if i % 2 else 0.5)
            t, i = t + step, i + 1

    def bass(a, b, step=0.5, vol=0.34, bounce=False, gate=0.8):
        t, i = a, 0
        while t < b - 1e-6:
            _, root = S.chord_at(t)
            m = root + 12 + (7 if bounce and i % 2 else 0)
            put("bass", t, tri(m, step * gate, vol))
            t, i = t + step, i + 1

    # 1. 50 v 50 (beats 0-8): the fanfare, full on.
    lead(S.FANFARE)
    arp(0, 8)
    bass(0, 8)
    for b in range(0, 8):
        kick(b) if b % 2 == 0 else snare(b)
        hat(b + 0.5)
    for i in range(4):
        snare(7 + i * 0.25, 0.1 + 0.04 * i)

    # 2. The town (8-24): lighter. A thin, bouncy lead, a hopping bass, off-beat chord pips; no snare.
    lead(S.TOWN, duty=0.125, vol=0.19, gate=0.7, vib=0)
    bass(8, 24, step=1, vol=0.3, bounce=True, gate=0.45)
    for b in range(8, 24):
        notes, _ = S.chord_at(b)
        for j, m in enumerate(notes[1:]):
            put("arp", b + 0.5, pulse(m, 0.22, 0.25, 0.06, decay=0.04, sustain=0.3), 0.5 if j else -0.5)
        hat(b + 0.5, 0.06)
        if b % 2 == 0:
            kick(b, 0.3)

    # The swirl (24-28): a climb, a rising whoop and a roll that tightens.
    lead(S.RISER, duty=0.25, vol=0.18, vib=0)
    bass(24, 28, step=0.25, vol=0.3)
    put("arp", 26, pulse(57, 2, 0.5, 0.07, bend=(0, 24), sustain=1.0))
    for i in range(16):
        snare(24 + i * 0.25, 0.05 + 0.011 * i)
    for i in range(8):
        snare(27 + i * 0.125, 0.14 + 0.012 * i)

    # "A boss appears" (28-32): the hit, then his stomp in octaves.
    crash(28, 0.34)
    for i, m in enumerate([62, 65, 69, 74, 77, 81, 86, 81]):
        put("arp", 28 + i * 0.125, pulse(m, 0.12, 0.25, 0.1), 0.5 if i % 2 else -0.5)
    for b, d, m in S.BOSS:
        put("lead", b, pulse(m, d * 0.85, 0.25, 0.24, decay=0.12, sustain=0.5))
        put("lead", b, pulse(m + 12, d * 0.85, 0.125, 0.09))
        put("bass", b, tri(m, d * 0.85, 0.36))
        kick(b, 0.55)
    snare(31, 0.2), snare(31.5, 0.22), snare(31.75, 0.24)

    # 3. Ranked (32-43): the fanfare again over a driving beat.
    lead(S.RANKED, octave=12)
    arp(32, 43)
    bass(32, 43)
    for b in range(32, 43):
        kick(b) if b % 2 == 0 else snare(b)
        kick(b + 0.75, 0.3) if b % 2 == 0 else None
        for q in (0.25, 0.5, 0.75):
            hat(b + q, 0.05 if q != 0.5 else 0.08)

    # The run up the ranks (43-48): one note per rank over a held bass and a growing roll.
    for i, (b, d, m) in enumerate(S.RUN):
        v = 0.15 + 0.012 * i
        put("lead", b, pulse(m, 0.8, 0.5, v, decay=0.1, sustain=0.35))
        put("lead", b, pulse(m + 12, 0.8, 0.125, v * 0.5, decay=0.1, sustain=0.35))
    bass(43, 48, vol=0.3)
    kick(43)
    for i in range(20):
        snare(43 + i * 0.25, 0.04 + 0.011 * i)

    # Transcendent (48-52): a bright D major burst that sparkles and rings out.
    crash(48, 0.36, 0.6)
    kick(48, 0.6)
    burst = [62, 66, 69, 74, 78, 81, 86, 90, 93, 98]
    for i, m in enumerate(burst):
        put("arp", 48 + i * 0.1, pulse(m, 0.5, 0.25, 0.1, decay=0.12, sustain=0.2), 0.6 if i % 2 else -0.6)
    put("lead", 48, pulse(S.STINGER_TOP, 3.4, 0.5, 0.2, vib=0.007, decay=0.6, sustain=0.25, release=0.5))
    put("lead", 48, pulse(S.STINGER_TOP - 8, 3.4, 0.25, 0.1, decay=0.6, sustain=0.25, release=0.5))
    put("bass", 48, tri(50, 3.4, 0.36, decay=0.8, sustain=0.3, release=0.4))
    for i in range(10):  # the held chord, shimmering
        f = 1 - i / 10
        for j, m in enumerate([74, 78, 81]):
            put("arp", 49 + i * 0.25 + j * 0.083, pulse(m, 0.08, 0.125, 0.09 * f), -0.6 + 0.6 * j)
    for b, m in [(49.5, 93), (50.25, 98), (50.75, 102)]:
        put("arp", b, pulse(m, 0.6, 0.125, 0.05, decay=0.08, sustain=0.0), 0.4)

    # 4. The Hidden Boss (52-62): a low held D, a minor second leaning on it, two slow breaths of noise, one glint.
    put("drum", 52, tri(38, 0.5 / beat_s, 0.5, bend=(10, -8), decay=0.2, sustain=0.0))

    def swell(x, top=0.5):
        """Fades a held note in up to `top` (a share of its length) and out after it."""
        t = np.linspace(0, 1, len(x))
        return x * np.sin(np.pi * np.clip(t / (2 * top), 0, 0.5) + np.pi * np.clip((t - top) / (2 * (1 - top)), 0, 0.5)) ** 2

    held = dict(attack=0.01, sustain=1.0, release=0.05)
    put("dark", 52, swell(tri(38, 10.5, 0.15, **held), 0.15))
    put("dark", 52, swell(pulse(50, 10.5, 0.125, 0.035, **held), 0.15), -0.3)
    put("dark", 52, swell(pulse(50.12, 10.5, 0.125, 0.035, **held), 0.15), 0.3)  # a hair sharp: a slow beat between the two
    put("dark", 54, swell(pulse(51, 4.5, 0.25, 0.045, **held), 0.6))  # the E flat, rubbing against the D
    for a, d in ((53.0, 2.6), (57.2, 2.8)):
        k = int(d * beat_s * sr)
        w = np.repeat(rng.uniform(-1, 1, k // 160 + 1), 160)[:k]
        w = np.cumsum(w - np.mean(w))
        w = (w - np.linspace(w[0], w[-1], k)) / (np.max(np.abs(w)) + 1e-9)
        put("dark", a, w * np.sin(np.pi * np.linspace(0, 1, k)) ** 2 * 0.06)
    put("lead", 59.5, pulse(98, 0.5, 0.125, 0.07, decay=0.1, sustain=0.0))  # the glint of his eye

    # The way back (62-64): a roll swells and two pickup notes cross the loop point into the fanfare.
    for i in range(8):
        put("bass", 62 + i * 0.25, tri(45, 0.2, 0.1 + 0.03 * i))
        snare(62 + i * 0.25, 0.03 + 0.018 * i)
    lead(S.PICKUP, vol=0.18, vib=0)
    snare(63.75, 0.2)

    # Mix: a two-tap echo on the lead (circular, so it wraps the loop too), then down to 48 kHz.
    d1 = int(0.75 * beat_s * sr)
    ld = buses["lead"]
    ld = ld + 0.28 * np.roll(ld[::-1], d1, axis=1) + 0.12 * np.roll(ld, 2 * d1, axis=1)
    mix = ld + buses["arp"] + buses["bass"] + buses["drum"] + buses["dark"]
    mix = mix.reshape(2, -1, OS).mean(axis=2)
    # A gentle low-pass near 9 kHz, done on the whole loop's spectrum so it wraps the loop point too.
    spec = np.fft.rfft(mix, axis=1)
    f = np.fft.rfftfreq(mix.shape[1], 1 / SR)
    out_ = np.fft.irfft(spec / np.sqrt(1 + (f / 9000) ** 2), n=mix.shape[1], axis=1)
    write_wav(out, out_)


def write_wav(path: str, x: np.ndarray, rate: int = SR) -> None:
    """Float stereo (2, n) -> 32-bit float can't be read everywhere, so 24-bit-safe 16-bit after a peak check."""
    peak = float(np.max(np.abs(x)))
    if peak > 0.98:
        x = x * (0.98 / peak)
    pcm = (x.T * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else S.REEL_S)
