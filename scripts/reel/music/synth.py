"""The trailer's two soundtracks' instruments: every sample computed here (no samples, no files, no AI audio), written
into a circular buffer the length of the cut, so each track loops without a seam.

Chip voices (track A, as packages/app/src/characters/synth.ts makes the bosses' sounds): pulse waves, a 16-step
triangle, noise. 16-bit-console voices (track B): additive "strings", a breathy flute, a plucked string
(Karplus-Strong), an FM bell, a round FM bass, a timpani, a small brass stab.
"""
import wave

import numpy as np

SR = 48000


class Mix:
    def __init__(self, secs: float, beats: float, os: int = 1, offset_s: float = 0.0, seed: int = 7):
        self.os = os
        self.sr = SR * os
        self.N = int(round(secs * SR)) * os
        self.beat_s = secs / beats
        self.offset_s = offset_s
        self.rng = np.random.default_rng(seed)
        self.buses: dict[str, np.ndarray] = {}

    # ---- plumbing ----
    def bus(self, name: str) -> np.ndarray:
        if name not in self.buses:
            self.buses[name] = np.zeros((2, self.N))
        return self.buses[name]

    def put(self, bus: str, beat: float, x: np.ndarray, pan: float = 0.0) -> None:
        b = self.bus(bus)
        i0 = int(round((self.offset_s + beat * self.beat_s) * self.sr)) % self.N
        gl, gr = 1 - max(0.0, pan), 1 + min(0.0, pan)
        k = len(x)
        done = 0
        while done < k:  # wraps round the loop point
            n = min(k - done, self.N - i0)
            b[0, i0 : i0 + n] += x[done : done + n] * gl
            b[1, i0 : i0 + n] += x[done : done + n] * gr
            done += n
            i0 = 0

    def k(self, beats: float) -> int:
        return max(int(beats * self.beat_s * self.sr), 64)

    @staticmethod
    def hz(m: float) -> float:
        return 440.0 * 2 ** ((m - 69) / 12)

    def env(self, k: int, attack=0.003, decay=0.09, sustain=0.6, release=0.02) -> np.ndarray:
        t = np.arange(k) / self.sr
        e = sustain + (1 - sustain) * np.exp(-t / decay)
        e *= np.minimum(1, t / attack)
        e *= np.minimum(1, (k - 1 - np.arange(k)) / (release * self.sr))
        return e

    def _freq(self, m, k, vib=0.0, bend=None, vib_hz=6.0):
        t = np.arange(k) / self.sr
        f = np.full(k, self.hz(m))
        if vib:
            f = f * (1 + vib * np.sin(2 * np.pi * vib_hz * t) * np.clip((t - 0.12) / 0.15, 0, 1))
        if bend is not None:
            f = f * 2 ** (np.linspace(bend[0], bend[1], k) / 12)
        return f, t

    # ---- chip voices ----
    def pulse(self, m, beats, duty=0.5, vol=0.2, vib=0.0, bend=None, **kw) -> np.ndarray:
        k = self.k(beats)
        f, _ = self._freq(m, k, vib, bend)
        ph = np.cumsum(f) / self.sr
        return np.where(ph % 1 < duty, 1.0, -1.0) * self.env(k, **kw) * vol

    def tri(self, m, beats, vol=0.3, bend=None, steps=True, **kw) -> np.ndarray:
        k = self.k(beats)
        f, _ = self._freq(m, k, 0, bend)
        ph = (np.cumsum(f) / self.sr) % 1
        w = 4 * np.abs(ph - 0.5) - 1
        if steps:
            w = np.round(w * 7.5) / 7.5  # 16 steps, like the old consoles' triangle
        kw.setdefault("sustain", 1.0)
        return w * self.env(k, **kw) * vol

    def noise(self, secs, rate, vol=0.2, decay=0.08, attack=0.001) -> np.ndarray:
        k = int(secs * self.sr)
        hold = max(1, int(self.sr / rate))
        w = np.repeat(self.rng.uniform(-1, 1, k // hold + 1), hold)[:k]
        t = np.arange(k) / self.sr
        return w * np.exp(-t / decay) * np.minimum(1, t / attack) * vol * np.minimum(1, (k - 1 - np.arange(k)) / (0.004 * self.sr))

    def rumble(self, beats, vol=0.06, hold=160) -> np.ndarray:
        """A slow breath of low noise that swells and dies."""
        k = self.k(beats)
        hold *= self.os
        w = np.repeat(self.rng.uniform(-1, 1, k // hold + 1), hold)[:k]
        w = np.cumsum(w - np.mean(w))
        w = (w - np.linspace(w[0], w[-1], k)) / (np.max(np.abs(w)) + 1e-9)
        return w * np.sin(np.pi * np.linspace(0, 1, k)) ** 2 * vol

    @staticmethod
    def swell(x, top=0.5):
        """Fades a held note in up to `top` (a share of its length) and out after it."""
        t = np.linspace(0, 1, len(x))
        return x * np.sin(np.pi * np.clip(t / (2 * top), 0, 0.5) + np.pi * np.clip((t - top) / (2 * (1 - top)), 0, 0.5)) ** 2

    # ---- 16-bit-console voices ----
    def add(self, m, beats, harm, vol=0.2, detune=(0.0,), vib=0.0, bright=None, **kw) -> np.ndarray:
        """Additive: `harm` the harmonics' levels (1st first); `detune` cents, one copy each (a chorus);
        `bright` (decay s): the upper harmonics die away that fast (a plucked or blown attack)."""
        k = self.k(beats)
        out = np.zeros(k)
        for c in detune:
            f, t = self._freq(m + c / 100, k, vib, None, 5.2)
            ph = 2 * np.pi * np.cumsum(f) / self.sr
            for i, a in enumerate(harm):
                n = i + 1
                if a == 0 or self.hz(m) * n > 0.45 * SR:
                    continue
                w = a * np.sin(n * ph + 0.7 * i)
                if bright is not None and i > 0:
                    w = w * (0.25 + 0.75 * np.exp(-t * i / (bright * 3)))
                out += w
        return out / len(detune) * self.env(k, **kw) * vol

    SAW = [1 / n for n in range(1, 13)]
    STRINGS = [1, 0.55, 0.38, 0.22, 0.2, 0.1, 0.1, 0.05, 0.05, 0.03]
    FLUTE = [1, 0.32, 0.1, 0.05, 0.02]
    BRASS = [1, 0.8, 0.65, 0.5, 0.36, 0.26, 0.18, 0.12, 0.08, 0.05]
    REED = [1, 0.05, 0.6, 0.05, 0.35, 0.04, 0.2, 0.03, 0.1]

    def strings(self, m, beats, vol=0.1, **kw) -> np.ndarray:
        kw.setdefault("attack", 0.06), kw.setdefault("sustain", 0.85), kw.setdefault("decay", 0.3), kw.setdefault("release", 0.12)
        return self.add(m, beats, self.STRINGS, vol, detune=(-7, 0, 8), vib=0.004, **kw)

    def flute(self, m, beats, vol=0.2, **kw) -> np.ndarray:
        kw.setdefault("attack", 0.025), kw.setdefault("sustain", 0.8), kw.setdefault("decay", 0.2), kw.setdefault("release", 0.05)
        x = self.add(m, beats, self.FLUTE, vol, vib=0.006, **kw)
        k = len(x)
        breath = self.rng.uniform(-1, 1, k) * np.exp(-np.arange(k) / self.sr / 0.03) * vol * 0.25
        return x + np.convolve(breath, np.ones(6) / 6, "same")

    def brass(self, m, beats, vol=0.15, **kw) -> np.ndarray:
        kw.setdefault("attack", 0.03), kw.setdefault("sustain", 0.7), kw.setdefault("decay", 0.15), kw.setdefault("release", 0.05)
        return self.add(m, beats, self.BRASS, vol, detune=(-4, 5), bright=0.25, **kw)

    def reed(self, m, beats, vol=0.15, **kw) -> np.ndarray:
        kw.setdefault("attack", 0.012), kw.setdefault("sustain", 0.75), kw.setdefault("decay", 0.12), kw.setdefault("release", 0.04)
        return self.add(m, beats, self.REED, vol, vib=0.005, **kw)

    def pluck(self, m, beats, vol=0.25, damp=0.996, tone=0.5) -> np.ndarray:
        """A plucked string (Karplus-Strong): a burst of noise fed round a delay as long as the note's period."""
        k = self.k(beats)
        p = max(2, int(round(self.sr / self.hz(m))))
        buf = self.rng.uniform(-1, 1, p)
        buf = np.convolve(np.concatenate([buf, buf[:8]]), np.ones(1 + int(8 * (1 - tone))) / (1 + int(8 * (1 - tone))), "same")[:p]
        out = np.empty((k // p + 1) * p)
        for i in range(k // p + 1):
            out[i * p : (i + 1) * p] = buf
            buf = damp * 0.5 * (buf + np.roll(buf, 1))
        out = out[:k]
        return out * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * self.sr)) * vol

    def bell(self, m, beats, vol=0.15, ratio=3.5, index=2.2, decay=0.5) -> np.ndarray:
        """An FM bell: a sine whose phase another sine pushes about, the push dying away faster than the note."""
        k = self.k(beats)
        t = np.arange(k) / self.sr
        f = self.hz(m)
        x = np.sin(2 * np.pi * f * t + index * np.exp(-t / (decay * 0.5)) * np.sin(2 * np.pi * f * ratio * t))
        return x * np.exp(-t / decay) * np.minimum(1, t / 0.002) * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * self.sr)) * vol

    def fmbass(self, m, beats, vol=0.3, index=1.6, decay=0.25) -> np.ndarray:
        k = self.k(beats)
        t = np.arange(k) / self.sr
        f = self.hz(m)
        x = np.sin(2 * np.pi * f * t + index * np.exp(-t / 0.08) * np.sin(2 * np.pi * f * t))
        return x * (0.55 + 0.45 * np.exp(-t / decay)) * np.minimum(1, t / 0.004) * np.minimum(1, (k - 1 - np.arange(k)) / (0.015 * self.sr)) * vol

    def timp(self, m, secs=0.7, vol=0.4) -> np.ndarray:
        k = int(secs * self.sr)
        t = np.arange(k) / self.sr
        f = self.hz(m) * (1 + 0.5 * np.exp(-t / 0.02))
        ph = 2 * np.pi * np.cumsum(f) / self.sr
        x = np.sin(ph) + 0.4 * np.sin(1.5 * ph) * np.exp(-t / 0.1) + 0.25 * np.sin(2.01 * ph) * np.exp(-t / 0.15)
        thump = self.rng.uniform(-1, 1, k) * np.exp(-t / 0.008) * 0.5
        return (x * np.exp(-t / (secs * 0.35)) + thump) * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * self.sr)) * vol

    # ---- drums (noise and a bent triangle or sine) ----
    def kick(self, beat, vol=0.5, bus="drum", soft=False):
        if soft:
            k = int(0.22 * self.sr)
            t = np.arange(k) / self.sr
            f = 48 + 110 * np.exp(-t / 0.03)
            self.put(bus, beat, np.sin(2 * np.pi * np.cumsum(f) / self.sr) * np.exp(-t / 0.09) * vol)
        else:
            self.put(bus, beat, self.tri(52, 0.14 / self.beat_s, vol, bend=(18, -14), decay=0.05, sustain=0.0))

    def snare(self, beat, vol=0.22, bus="drum"):
        self.put(bus, beat, self.noise(0.16, 9000, vol, 0.05))
        self.put(bus, beat, self.tri(57, 0.05 / self.beat_s, vol * 0.6, bend=(4, -6), sustain=0.0, decay=0.02))

    def hat(self, beat, vol=0.07, bus="drum", pan=0.3):
        self.put(bus, beat, self.noise(0.04, 24000, vol, 0.012), pan)

    def crash(self, beat, vol=0.3, decay=0.45, bus="drum"):
        self.put(bus, beat, self.noise(1.6, 16000, vol, decay))

    # ---- the mix ----
    def echo(self, bus: str, beats: float, a=0.28, b=0.12) -> None:
        """A two-tap echo (circular, so it wraps the loop too); the first tap with the sides swapped."""
        d = int(beats * self.beat_s * self.sr)
        x = self.bus(bus)
        self.buses[bus] = x + a * np.roll(x[::-1], d, axis=1) + b * np.roll(x, 2 * d, axis=1)

    def down(self, x: np.ndarray) -> np.ndarray:
        return x.reshape(2, -1, self.os).mean(axis=2) if self.os > 1 else x

    def mixdown(self, levels: dict[str, float] | None = None, lowpass=9000.0, room=0.0, room_s=1.4) -> np.ndarray:
        mix = sum(self.down(b) * (levels or {}).get(n, 1.0) for n, b in self.buses.items())
        n = mix.shape[1]
        spec = np.fft.rfft(mix, axis=1)
        f = np.fft.rfftfreq(n, 1 / SR)
        if room:
            # A small hall: the whole loop convolved (circularly, so it wraps) with a burst of dying noise.
            k = int(room_s * SR)
            t = np.arange(k) / SR
            ir = np.zeros((2, n))
            ir[:, :k] = self.rng.normal(0, 1, (2, k)) * np.exp(-t / (room_s / 5)) * np.minimum(1, t / 0.012)
            ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
            wet = spec * np.fft.rfft(ir, axis=1) / (1 + (f / 5000) ** 2) * (f > 150)
            spec = spec + room * wet
        # A gentle low-pass, done on the whole loop's spectrum so it wraps the loop point too.
        return np.fft.irfft(spec / np.sqrt(1 + (f / lowpass) ** 2), n=n, axis=1)


def write_wav(path: str, x: np.ndarray, rate: int = SR) -> None:
    """Float stereo (2, n) -> 16-bit, after a peak check."""
    peak = float(np.max(np.abs(x)))
    if peak > 0.98:
        x = x * (0.98 / peak)
    pcm = (x.T * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


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
    """'D5:.75 F5:.5 -:1' -> [(beat, beats, midi)], notes one after another from `start` ('-' rests; '|' is only for the eye)."""
    out, t = [], start
    for tok in text.replace("|", " ").split():
        name, d = tok.split(":")
        d = float(d)
        if name != "-":
            out.append((t, d, n(name)))
        t += d
    return out


def length(text: str) -> float:
    return sum(float(tok.split(":")[1]) for tok in text.replace("|", " ").split())


def chords(spec):
    """[(from, to, 'D4 F4 A4', 'D2')] -> a lookup: beat -> (notes, bass)."""
    table = [(a, b, [n(x) for x in notes.split()], n(bass)) for a, b, notes, bass in spec]

    def at(beat: float):
        for a, b, notes, bass in table:
            if a <= beat < b:
                return notes, bass
        raise ValueError(f"no chord at beat {beat}")

    return at
