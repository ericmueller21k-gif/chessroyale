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

    # ---- soft voices Eric picked by ear (Nov 12, for the Hidden Boss's memory and his house: SOUNDS.md) ----
    def ocarina(self, m, beats, vol=0.06) -> np.ndarray:
        """An ocarina: round and hollow, almost no breath, each note leaning up into place. `m` can be a fraction
        (a note between two notes)."""
        w = self.tone(m, beats, [1, 0.03, 0.07, 0.01, 0.02], vol, vib=0.003, vib_hz=4.5, scoop=0.3, scoop_s=0.04, attack=0.04, release=0.08)
        k = len(w)
        t = np.arange(k) / self.sr
        hold = max(1, int(self.sr / 9000))
        r = self.rng.uniform(-1, 1, k // hold + 2)
        air = np.convolve(np.repeat(r[1:] - 0.6 * r[:-1], hold)[:k], np.ones(8) / 8, "same") * (0.006 + 0.02 * np.exp(-t / 0.05)) * vol / 0.06
        return w + air * np.minimum(1, t / 0.02) * np.minimum(1, (k - 1 - np.arange(k)) / (0.1 * self.sr))

    def struck(self, kind, m, cents=0.0) -> np.ndarray:
        """One note, its loudest point 1, two and a half seconds, kept once made. "felt": a soft piano, felt on its
        hammers (built from its harmonics, the high ones few and quick to die; two strings a hair apart; a soft
        thump). "box": a music box's tooth. "pan": a steel pan's note. "handpan": a handpan's, rounder and longer.
        "vibes": a vibraphone's bar, its motor turning. "tines": an electric piano. "koto": a koto's string, picked.
        `cents`: how far out of tune."""
        made = self.__dict__.setdefault("_struck", {})
        key = (kind, m, round(cents))
        if key not in made:
            k = int(2.5 * self.sr)
            t = np.arange(k) / self.sr
            tau = 2 * np.pi
            f0 = self.hz(m + cents / 100)
            far = (262 / f0) ** 0.35  # a low note rings longer
            rise, hit, dull = 0.001, 0.0, 1400  # the touch: how quick; how much of a thump (noise) and how dull it is

            def ring(rows):
                """Partials that ring and die: (times the note's pitch, how loud, seconds to die away at middle C)."""
                return sum(a * np.sin(tau * f0 * r * t + 1.7 * i) * np.exp(-t / (d * far)) for i, (r, a, d) in enumerate(rows))

            if kind == "felt":
                h = np.arange(1, max(2, int(3500 / f0) + 1))
                loud = (1 + 0.5 * np.exp(-(((h * f0 - 450) / 300) ** 2))) / h**1.7
                w = np.zeros(k)
                for off in (-1.2, 1.2):
                    f = f0 * 2 ** (off / 1200)
                    w += (loud[:, None] * np.sin(np.outer(h * np.sqrt(1 + 0.0004 * h * h), 2 * np.pi * f * t) + h[:, None])
                          * np.exp(-np.outer(1 + 0.3 * h, t) / (1.1 * (262 / f0) ** 0.35))).sum(axis=0)
                rise, hit = 0.004, 0.125
            elif kind == "box":
                w = np.sin(2 * np.pi * f0 * t + 1.2 * np.exp(-t / 0.25) * np.sin(2 * np.pi * 3.5 * f0 * t)) * np.exp(-t / 0.5)
            elif kind == "pan":
                # The dent's own pitch (two modes a hair apart, so it shimmers), its octave swelling in just after the
                # stick, its twelfth a little sharp, a quick high ping; hit, the steel brightens it (the soft clip).
                w = ring([(1, 1.0, 0.5), (1.004, 0.3, 0.45), (3.012, 0.22, 0.2), (4.02, 0.1, 0.14), (5.93, 0.1, 0.05), (8.2, 0.06, 0.03)])
                w = np.tanh(1.3 * (w + 0.6 * np.sin(tau * 2 * f0 * t + 0.5) * (1 - 0.7 * np.exp(-t / 0.02)) * np.exp(-t / (0.32 * far))))
                size = int(round(4 * self.sr / f0))  # (the clip leaves a slow push under the note: taken out, four periods at a time)
                w -= np.convolve(w, np.ones(size) / size, "same")
                rise, hit, dull = 0.0015, 0.06, 3000
            elif kind == "handpan":
                # Its pitch, its octave and the fifth over that (tuned 1 : 2 : 3), round and long; a finger's touch.
                w = ring([(1, 1.0, 1.1), (1.003, 0.25, 1.0), (2, 0.5, 0.8), (3, 0.28, 0.55), (4.03, 0.05, 0.2)])
                rise, hit, dull = 0.004, 0.1, 700
            elif kind == "vibes":
                # A bar cut so its second partial is two octaves up; a soft mallet; the motor's slow tremolo.
                w = ring([(1, 1.0, 1.7), (4, 0.2, 0.4), (10.1, 0.05, 0.09)]) * (1 - 0.28 * (0.5 - 0.5 * np.cos(tau * 5.2 * t)))
                rise, hit = 0.003, 0.05
            elif kind == "tines":
                # A tine and its pickup: a sine that pushes itself about while it's loud (the bark) and a quick, very
                # high ting on the front of it; a second, quieter, a hair off (quieter, so the two never cancel).
                w = np.zeros(k)
                for off, loud in ((-1.2, 1.0), (1.8, 0.4)):
                    ph = tau * f0 * 2 ** (off / 1200) * t
                    w += loud * (np.sin(ph + 1.1 * np.exp(-t / 0.3) * np.sin(ph)) + 0.5 * np.exp(-t / 0.2) * np.sin(ph + 1.2 * np.exp(-t / 0.07) * np.sin(14 * ph)))
                w *= np.exp(-t / (1.1 * far))
                rise = 0.002
            elif kind == "koto":
                # A string picked a ninth of the way along: every harmonic but the ninth, the high ones dying first;
                # the pick's pull bends it sharp for an instant. (The harmonics start out of step, so no spike.)
                ph = tau * np.cumsum(f0 * 2 ** (0.3 * np.exp(-t / 0.03) / 12)) / self.sr
                h = np.arange(1, max(2, min(36, int(8000 / f0)) + 1))
                w = (np.abs(np.sin(np.pi * h / 9) / h)[:, None] * np.sin(np.outer(h * np.sqrt(1 + 0.0002 * h * h), ph) + (np.pi * h * h / len(h))[:, None])
                     * np.exp(-np.outer(1 + 0.22 * h, t) / far)).sum(axis=0)
                rise, hit, dull = 0.0008, 0.12, 6000
            else:
                raise ValueError(kind)
            if hit:
                # (A newer kind's noise is its own, so adding one to a song leaves the song's other noises as they were.)
                rng = self.rng if kind == "felt" else np.random.default_rng(1000 + int(m))
                size = max(2, int(self.sr / dull))
                thump = np.convolve(rng.uniform(-1, 1, k + 2 * size), np.ones(size) / size, "same")[size : size + k]
                w = w / (np.max(np.abs(w)) + 1e-9) + hit * thump / (np.sqrt(np.mean(thump**2)) + 1e-9) * np.exp(-t / 0.006)
            made[key] = w / (np.max(np.abs(w)) + 1e-9) * np.minimum(1, t / rise) * np.minimum(1, (k - 1 - np.arange(k)) / (0.05 * self.sr))
        return made[key]

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


class Ride(Mix):
    """A Mix on a tape that doesn't run at one speed. Notes go onto the tape at the band's own tempo and pitch
    (`at(beat, beats)` before making a note sets its length; `put` places it); `play` then runs the tape at the
    ride's speed, so tempo and pitch rise and sink together, as a record's do when its motor starts or dies."""

    STEP = 1 / 192

    def __init__(self, plan, beats_, secs, os=1, seed=7, tape_secs=None):
        """`secs`: how long the song is as heard (the tempos are all scaled alike until it is). Or `tape_secs`: how
        long the tape is, the heard length following from it: for a long song, a tape whose length in samples has
        only small factors keeps the mix's transforms quick."""
        grid = np.arange(0, beats_ + self.STEP / 2, self.STEP)
        bpm, speed, waver = np.zeros(len(grid)), np.ones(len(grid)), np.zeros(len(grid))
        for a, b, t0, t1, s0, s1, w in plan:
            on = (grid >= a - 1e-9) & (grid < b - 1e-9)
            u = (grid[on] - a) / (b - a)
            bpm[on], speed[on], waver[on] = t0 + (t1 - t0) * u, s0 * (s1 / s0) ** u, w
        bpm[-1], speed[-1] = plan[-1][3], plan[-1][5]
        scale = 1.0
        for _ in range(8):
            tape = np.concatenate([[0], np.cumsum(60 / (bpm[:-1] * scale) * self.STEP)])
            # The waver: a slow drift, a quicker one and a flutter, together at most `waver` either way.
            wow = (np.sin(2 * np.pi * 0.6 * tape) + 0.5 * np.sin(2 * np.pi * 1.37 * tape + 1.0) + 0.2 * np.sin(2 * np.pi * 6.3 * tape)) / 1.7
            s = speed * (1 + waver * wow)
            heard = np.concatenate([[0], np.cumsum(60 / (bpm[:-1] * scale * s[:-1]) * self.STEP)])
            now, want = (tape[-1], tape_secs) if tape_secs else (heard[-1], secs)
            if abs(now - want) < 1e-7:
                break
            scale *= now / want
        self.grid, self.tape, self.heard, self.secs, self.scale = grid, tape, heard, float(heard[-1]) if tape_secs else secs, scale
        super().__init__(float(tape[-1]), beats_, os=os, seed=seed)

    def t(self, beat: float) -> float:
        """Where on the tape a beat is, in seconds."""
        return float(np.interp(beat, self.grid, self.tape))

    def when(self, beat: float) -> float:
        """When a beat is heard, in seconds."""
        return float(np.interp(beat, self.grid, self.heard))

    def speed(self, beat: float) -> float:
        """How fast the tape runs at a beat."""
        return (self.t(beat + self.STEP) - self.t(beat)) / (self.when(beat + self.STEP) - self.when(beat))

    # For a sample of one passage (to compare instruments on it): (from beat, to beat). Notes outside it, bar a few
    # beats before whose tails ring in, are neither made (their length is cut to nothing) nor placed, so it's quick.
    # `lead`: how many beats before it are made too (0: a clean cut, to build a piece of the song by itself).
    window = None
    lead = 8.0
    now = 0.0

    def outside(self, beat: float) -> bool:
        return self.window is not None and not self.window[0] - self.lead <= beat < self.window[1]

    def at(self, beat: float, beats_: float = 1.0) -> None:
        self.now = beat
        self.beat_s = (self.t(beat + beats_) - self.t(beat)) / beats_

    def k(self, beats_: float) -> int:
        return 64 if self.outside(self.now) else super().k(beats_)

    def put(self, bus, beat, x, pan=0.0, late=0.0):
        """`late`: seconds after the beat."""
        b = self.bus(bus)
        if self.outside(beat):
            return
        i0 = int(round((self.t(beat) + late) * self.sr)) % self.N
        gl, gr = 1 - max(0.0, pan), 1 + min(0.0, pan)
        k, done = len(x), 0
        while done < k:
            m = min(k - done, self.N - i0)
            b[0, i0 : i0 + m] += x[done : done + m] * gl
            b[1, i0 : i0 + m] += x[done : done + m] * gr
            done, i0 = done + m, 0

    def play(self, mix: np.ndarray) -> np.ndarray:
        """The mixed tape as it's heard: read at the ride's speed (the four nearest samples, a smooth curve through them)."""
        k = int(round(self.secs * SR))
        pos = np.interp(np.arange(k) / SR, self.heard, self.tape) * SR
        i = np.floor(pos).astype(np.int64)
        f = pos - i
        size = mix.shape[1]
        out = np.empty((2, k))
        for c in range(2):
            a, b, d, e = (mix[c, (i + j) % size] for j in (-1, 0, 1, 2))
            out[c] = b + 0.5 * f * (d - a + f * (2 * a - 5 * b + 4 * d - e + f * (3 * (b - d) + e - a)))
        return out


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
