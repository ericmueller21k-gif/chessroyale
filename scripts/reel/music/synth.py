"""The trailer's two soundtracks' instruments: every sample computed here (no samples, no files, no AI audio), written
into a circular buffer the length of the cut, so each track loops without a seam.

Chip voices (track A, as packages/app/src/characters/synth.ts makes the bosses' sounds): pulse waves, a 16-step
triangle, noise. 16-bit-console voices (track B): additive "strings", a breathy flute, a plucked string
(Karplus-Strong), an FM bell, a round FM bass, a timpani, a small brass stab, an overdriven lead.
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

    # ---- leads Eric picked by ear (Nov 11, from seven tried on the woodshop songs): "Fiddle, gritty, both great, square too" ----
    def tone(self, m, beats, harm, vol, detune=(0.0,), vib=0.0, vib_hz=5.5, scoop=0.0, scoop_s=0.03, attack=0.02, release=0.03,
             trem=0.0, trem_hz=6.0, bright=None) -> np.ndarray:
        """A held note built from its harmonics: `detune` cents, a copy each; `vib` once the note settles; `scoop`
        semitones: it slides up into the note from that far under; `trem`: the level wobbles; `bright` (s): the upper
        harmonics die away that fast."""
        k = self.k(beats)
        t = np.arange(k) / self.sr
        out = np.zeros(k)
        for c in detune:
            f = self.hz(m + c / 100) * (1 + vib * np.sin(2 * np.pi * vib_hz * t) * np.clip((t - 0.1) / 0.12, 0, 1)) * 2 ** (-scoop * np.exp(-t / scoop_s) / 12)
            ph = 2 * np.pi * np.cumsum(f) / self.sr
            for i, a in enumerate(harm):
                if a == 0 or self.hz(m) * (i + 1) > 0.45 * SR:
                    continue
                w = a * np.sin((i + 1) * ph + 0.7 * i)
                out += w * (0.25 + 0.75 * np.exp(-t * i / (bright * 3))) if bright is not None and i > 0 else w
        env = np.minimum(1, t / attack) * np.minimum(1, (k - 1 - np.arange(k)) / (release * self.sr))
        if trem:
            env = env * (1 - trem * (0.5 - 0.5 * np.cos(2 * np.pi * trem_hz * t)))
        return out / len(detune) * env * vol

    BOWED = [1, 0.72, 0.55, 0.42, 0.3, 0.24, 0.18, 0.13, 0.1, 0.07, 0.05]

    def fiddle(self, m, beats, vol=0.145) -> np.ndarray:
        """A fiddle: a bowed string, a little slide up into each note, vibrato on the long ones (a quarter second up)."""
        long = beats * self.beat_s >= 0.24
        return self.tone(m, beats, self.BOWED, vol, vib=0.01 if long else 0.0, vib_hz=6.0, scoop=0.6 if long else 0.25, scoop_s=0.025,
                         attack=0.04 if long else 0.014)

    def gritty(self, m, beats, vol=0.21) -> np.ndarray:
        """A drum-and-bass lead: three sawtooths a hair apart, driven hard, each note opening bright and closing."""
        w = self.tone(m, beats, [1 / h for h in range(1, 17)], 1.0, detune=(-14, 0, 13), scoop=0.5, scoop_s=0.02, attack=0.006, release=0.02, bright=0.12)
        return np.tanh(2.2 * w) * vol

    def chip(self, m, beats, vol=0.15) -> np.ndarray:
        """The old console's lead: a quarter pulse, vibrato on the long notes, with a square an octave under it."""
        long = beats * self.beat_s >= 0.3
        k = self.k(beats)
        top = self.pulse(m, beats, 0.25, vol, vib=0.012 if long else 0.0, decay=0.2, sustain=0.6, release=0.008)
        return top + self.pulse(m - 12, beats, 0.5, 0.4 * vol, decay=0.2, sustain=0.6, release=0.008)[:k]

    def drive(self, m, beats, vol=0.15, vib=0.007, vib_hz=4.2, attack=0.07, release=0.04, top=8500.0, knee=1500.0, glide=0.0, glide_s=0.035) -> np.ndarray:
        """An overdriven lead, the 16-bit consoles' lead-guitar sound, built from measurements of a reference's lead
        (Eric, Nov 11; no sample of it is used): every harmonic present, those up to 1.5 kHz all about 3 dB under the
        fundamental, falling 9 dB an octave from there to 4 kHz and 6.5 above, nothing over `top` Hz; a soft start;
        held, sinking only a little; a slow, shallow vibrato (4.2 times a second, 12 cents each way) once the note
        settles. Each harmonic's level drifts a little on its own, as a driven string's do. `knee`: where the fall
        starts; lower is darker (Moo & Moon's is 1400). `glide` semitones: the note slides in from that far off (Moo's)."""
        k = self.k(beats)
        f, t = self._freq(m, k, vib, None, vib_hz)
        if glide:
            f = f * 2 ** (glide * np.exp(-t / glide_s) / 12)
        ph = 2 * np.pi * np.cumsum(f) / self.sr
        f0 = self.hz(m)
        out = np.sin(ph)
        h = 2
        while h * f0 < top:
            fh = h * f0
            db = -3.0 - 9.0 * np.clip(np.log2(fh / knee), 0.0, np.log2(4000 / knee)) - 6.5 * max(0.0, np.log2(fh / 4000.0))
            drift = 1 + 0.1 * np.sin(2 * np.pi * (2.3 + 0.37 * ((h * 7) % 5)) * t + 1.9 * h)
            out += 10 ** (db / 20) * drift * np.sin(h * ph + 2.4 * h * h)  # the phases scattered, so the wave isn't one spike a cycle
            h += 1
        a = min(attack, 0.4 * k / self.sr)
        return out * np.minimum(1, t / a) * np.exp(-t / 1.5) * np.minimum(1, (k - 1 - np.arange(k)) / (release * self.sr)) * vol

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
