"""
The Colosseum's crowd (Eric, Oct 30: "crowd cheer, crowd shocked, crowd boo, and crowd ambient noise ... steady
background layered chatter like you'd hear watching a FIFA World Cup game"). Step 1: candidates for Eric to hear,
each made two ways, so he can compare; nothing here is wired into the game yet.

- A: built from free recordings (CC0 or public domain first; CC BY only where nothing CC0 was good: Gregor
  Quendel's crowd, for the ambient and the cheer), trimmed, layered into a bigger crowd, EQ'd and leveled here. Each
  recording's URL, author and license are in SOURCES (below); the CREDITS.md handed over with the files repeats them.
- B: made here from nothing: many detuned "voices" (a buzzing glottal source through moving vowel formants, with
  breath and consonant noise) talking, cheering, gasping or booing, layered near and far, with a synthetic stadium
  echo. Ours: no third-party rights.

The four, each as A and B:
- ambient: a seamless loop (24 s): a big stadium's steady murmur, layered chatter far and near, no clear words, nothing
  that pops out.
- cheer (3.5 s): a crowd erupting and settling.
- shocked (1.6 s): a crowd's sharp "ooh!".
- boo (2.6 s): a crowd booing, good-natured.

Leveled as the game levels its sounds (piece-sounds.py's `loudness`: the loudest 30 ms through a phone speaker's
200 Hz high-pass and the game's 6 kHz low-pass): the reactions at a move's loudness (sounds/move.mp3); the ambient
LEVELS["ambient"] dB under it, so it sits well under a move and you can talk over it. mp3, mono, 96 kb/s.

    # the recordings for the A files, in one folder (each file's URL is in SOURCES below):
    python3 scripts/crowd-sounds.py --out <dir> --sources <src dir> [name ...]   # A and B
    python3 scripts/crowd-sounds.py --out <dir> [name ...]                       # B only (no download needed)
    # names: ambient-A, ambient-B, cheer-A, ... (default: all). Needs numpy, scipy and ffmpeg.
"""
import argparse, glob, math, os, subprocess, sys
import numpy as np
from scipy.signal import lfilter

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
SOUNDS = os.path.join(HERE, "../packages/app/public/sounds")

# dB relative to a move's loudness (the loudest 30 ms, as `loudness` measures it).
LEVELS = {"ambient": -15.0, "cheer": 0.0, "shocked": 0.0, "boo": -1.0}
LENGTHS = {"ambient": 24.0, "cheer": 3.5, "shocked": 1.6, "boo": 2.6}


# --- Shared tools (the measure is piece-sounds.py's, the filters RBJ's) -----------------------------------------

def load(path, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def biquad_ba(kind, f, q=0.707, db=0.0):
    """RBJ biquad coefficients (the shapes of Web Audio's BiquadFilterNode)."""
    w = 2 * math.pi * f / SR
    c, s = math.cos(w), math.sin(w)
    a = s / (2 * q)
    if kind == "lowpass":
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
        den = [1 + a, -2 * c, 1 - a]
    elif kind == "highpass":
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
        den = [1 + a, -2 * c, 1 - a]
    elif kind == "bandpass":  # 0 dB peak
        b = [a, 0.0, -a]
        den = [1 + a, -2 * c, 1 - a]
    elif kind == "peak":
        A = 10 ** (db / 40)
        b = [1 + a * A, -2 * c, 1 - a * A]
        den = [1 + a / A, -2 * c, 1 - a / A]
    elif kind in ("lowshelf", "highshelf"):
        A = 10 ** (db / 40)
        r = 2 * math.sqrt(A) * s / 2 * math.sqrt(2)
        if kind == "highshelf":
            b = [A * ((A + 1) + (A - 1) * c + r), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - r)]
            den = [(A + 1) - (A - 1) * c + r, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - r]
        else:
            b = [A * ((A + 1) - (A - 1) * c + r), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - r)]
            den = [(A + 1) + (A - 1) * c + r, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - r]
    else:
        raise ValueError(kind)
    return np.array(b) / den[0], np.array(den) / den[0]


def filt(x, kind, f, q=0.707, db=0.0):
    b, a = biquad_ba(kind, f, q, db)
    return lfilter(b, a, x)


def loudness(x):
    """The loudest 30 ms (RMS, dB) as a phone plays it in the game: high-passed at 200 Hz, low-passed at 6 kHz."""
    y = filt(filt(x, "highpass", 200), "lowpass", 6000)
    w = int(0.03 * SR)
    p = np.convolve(y * y, np.ones(w) / w, mode="valid") if len(y) > w else np.array([np.mean(y * y)])
    return 10 * math.log10(max(p.max(), 1e-12))


def mean_loudness(x):
    """The whole sound's RMS (dB) through the same phone filters: how loud an ambient loop sits."""
    y = filt(filt(x, "highpass", 200), "lowpass", 6000)
    return 10 * math.log10(max(np.mean(y * y), 1e-12))


def fade(x, fin, fout):
    """A cosine fade-in over `fin` s and fade-out over `fout` s."""
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= 0.5 - 0.5 * np.cos(np.linspace(0, math.pi, a))
    if b:
        x[len(x) - b:] *= 0.5 + 0.5 * np.cos(np.linspace(0, math.pi, b))
    return x


def fit(x, length):
    out = np.zeros(int(length * SR))
    m = min(len(x), len(out))
    out[:m] = x[:m]
    return out


def resample(x, ratio):
    """Play `ratio` times faster (pitch up by 12 * log2(ratio) semitones, shorter by as much)."""
    return np.interp(np.arange(int(len(x) / ratio)) * ratio, np.arange(len(x)), x)


def fft_convolve(x, h):
    n = len(x) + len(h) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[:n]


def reverb_ir(rt60, seed, length=None, damp_hz=3000, predelay=0.02):
    """A big open bowl's echo: decaying noise (rt60 s to fall 60 dB), its highs dying sooner, after a short gap."""
    rng = np.random.default_rng(seed)
    length = length or rt60 * 1.2
    n = int(length * SR)
    t = np.arange(n) / SR
    lo = filt(rng.standard_normal(n), "lowpass", damp_hz) * np.exp(-6.91 * t / rt60)
    hi = filt(rng.standard_normal(n), "highpass", damp_hz) * np.exp(-6.91 * t / (rt60 * 0.45))
    h = lo + 0.5 * hi
    h = np.concatenate([np.zeros(int(predelay * SR)), h])
    return h / np.sqrt(np.sum(h * h))


BANDS = (250, 500, 1000, 2000, 4000, 8000)
# Long-term spectra (dB an octave band, the loudest band 0) a crowd's sound should have, from the textbook shapes of
# speech and shouting heard at a distance: talk peaks near 500 Hz to 1 kHz and falls off above; cheering is brighter;
# "oo" and "boo" are darker.
TILTS = {
    "crowd": (-12, -2, 0, -5, -14, -24),
    "cheer": (-14, -4, 0, -3, -11, -20),
    "ooh": (-4, 0, -3, -8, -16, -26),
    "boo": (-5, 0, -2, -7, -15, -25),
}


def bands(x):
    n = 4096
    segs = [x[i:i + n] * np.hanning(n) for i in range(0, len(x) - n, n // 2)]
    p = np.mean([np.abs(np.fft.rfft(s)) ** 2 for s in segs], axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    v = np.array([10 * math.log10(p[(f >= b / 1.414) & (f < b * 1.414)].sum() + 1e-20) for b in BANDS])
    return v - v.max()


def tilt(x, shape):
    """EQ `x` toward one of TILTS: three passes of octave-wide peaks (at most 18 dB each way a pass)."""
    for _ in range(3):
        miss = np.clip(np.array(TILTS[shape]) - bands(x), -18, 18)
        for b, g in zip(BANDS, miss):
            if abs(g) > 0.3:
                x = filt(x, "highshelf", b / 1.414, db=g) if b == BANDS[-1] else filt(x, "peak", b, 1.0, g)
    return x


def loop_wrap(x, length, xfade):
    """A seamless loop: the `xfade` s after `length` fade into its start (equal power: the parts don't correlate)."""
    n, c = int(length * SR), int(xfade * SR)
    out = x[:n].copy()
    t = np.linspace(0, math.pi / 2, c)
    out[:c] = x[:c] * np.sin(t) + x[n:n + c] * np.cos(t)
    return out


def steady(x, window=1.5, strength=0.7):
    """Evens out slow swells: divides by the moving RMS (raised to `strength`) so nothing rises above the murmur."""
    w = int(window * SR)
    p = np.sqrt(np.convolve(x * x, np.ones(w) / w, mode="same") + 1e-12)
    g = (np.median(p) / p) ** strength
    return x * g


# --- B: voices made here ----------------------------------------------------------------------------------------

# Vowel formants (Hz: F1, F2, F3) of an adult male voice (Peterson and Barney's averages); a woman's are ~17% higher.
VOWELS = {
    "a": (730, 1090, 2440), "ae": (660, 1720, 2410), "uh": (640, 1190, 2390), "e": (530, 1840, 2480),
    "i": (270, 2290, 3010), "ih": (390, 1990, 2550), "o": (570, 840, 2410), "u": (300, 870, 2240),
    "oo": (440, 1020, 2240), "er": (490, 1350, 1690),
}
BANDWIDTHS = (90, 110, 170)
BLOCK = 256


def resonate(x, freqs, bws):
    """A cascade formant filter (Klatt): one two-pole resonator a formant, unity gain at 0 Hz, its frequency moving
    block by block (`freqs`: one value a BLOCK)."""
    y = x
    for f_track, bw in zip(freqs, bws):
        r = math.exp(-math.pi * bw / SR)
        out = np.empty_like(y)
        zi = np.zeros(2)
        for k in range(0, len(y), BLOCK):
            th = 2 * math.pi * f_track[min(k // BLOCK, len(f_track) - 1)] / SR
            a1, a2 = -2 * r * math.cos(th), r * r
            g = 1 + a1 + a2
            seg, zi = lfilter([g], [1, a1, a2], y[k:k + BLOCK], zi=zi)
            out[k:k + BLOCK] = seg
        y = out
    return y


def glottal(f0, rng, breath=0.08, bright=0.0):
    """A voice's buzz at f0 (one value a sample): a sawtooth (falls 6 dB an octave, as a voice's source and lips do),
    a little jitter and shimmer, and breath noise pulsing with it. `bright` (0-1) sharpens it, as shouting does."""
    jitter = 1 + 0.01 * filt(rng.standard_normal(len(f0)), "lowpass", 30) * 3
    phase = np.cumsum(f0 * jitter / SR)
    frac = phase % 1.0
    saw = 1 - 2 * frac
    if bright:
        saw = (1 - bright) * saw + bright * np.where(frac < 0.15, 1 - frac / 0.15, 0.0) * 2 - bright * 0.15
    noise = rng.standard_normal(len(f0)) * (0.6 + 0.4 * np.cos(2 * math.pi * frac))
    return saw + breath * filt(noise, "highpass", 1200)


def per_block(track):
    """A per-sample track sampled once a BLOCK."""
    return track[::BLOCK]


def voice(rng, dur, plan, female, bright=0.0, breath=0.08):
    """
    One voice: `plan` lists syllables as (start s, length s, vowel or (vowel, vowel) for a glide, f0 start, f0 end,
    level, consonant: None, "s" (a hiss), "t" (a tick), "b" (a soft lip thump), "h" (breathy)).
    """
    n = int(dur * SR)
    f0 = np.full(n, 120.0)
    env = np.zeros(n)
    fm = [np.full(n, v) for v in VOWELS["uh"]]
    cons = np.zeros(n)
    scale = 1.17 if female else 1.0
    scale *= rng.uniform(0.94, 1.06)  # each voice's own vocal tract
    for start, length, vowel, fa, fb, level, consonant in plan:
        i, m = int(start * SR), int(length * SR)
        if i >= n or m < 8:
            continue
        m = min(m, n - i)
        t = np.linspace(0, 1, m)
        f0[i:i + m] = fa * (fb / fa) ** t
        v0, v1 = (vowel, vowel) if isinstance(vowel, str) else vowel
        for k in range(3):
            fm[k][i:i + m] = scale * (VOWELS[v0][k] + (VOWELS[v1][k] - VOWELS[v0][k]) * np.clip(t * 1.6, 0, 1))
        att = min(int(0.035 * SR), m // 3)
        rel = min(int(0.09 * SR), m // 2)
        e = np.ones(m)
        e[:att] = np.linspace(0, 1, att) ** 1.5
        e[m - rel:] *= np.linspace(1, 0, rel) ** 1.2
        env[i:i + m] = np.maximum(env[i:i + m], level * e)
        if consonant:
            c = int({"s": 0.07, "t": 0.012, "b": 0.02, "h": 0.06}[consonant] * SR)
            j = max(0, i - c // 2)
            c = min(c, n - j)
            burst = rng.standard_normal(c) * np.hanning(c)
            if consonant == "s":
                burst = filt(burst, "bandpass", rng.uniform(4500, 6500), 1.5) * 0.35
            elif consonant == "t":
                burst = filt(burst, "highpass", 2500) * 0.5
            elif consonant == "b":
                burst = filt(burst, "lowpass", 400) * 1.2
            else:
                burst = filt(burst, "bandpass", 1500, 0.7) * 0.25
            cons[j:j + c] += level * burst
    # Hold each formant between syllables at the last one (no jumps while silent).
    for k in range(3):
        on = env > 0
        idx = np.where(on, np.arange(n), 0)
        np.maximum.accumulate(idx, out=idx)
        fm[k] = fm[k][idx]
    f0s = f0[np.maximum.accumulate(np.where(env > 0, np.arange(n), 0))]
    src = glottal(f0s, rng, breath, bright)
    bws = [b * (1.1 if female else 1.0) for b in BANDWIDTHS]
    y = resonate(src * env, [per_block(f) for f in fm], bws)
    # F4 and F5 as a fixed presence lift, then the consonants.
    y = filt(y, "peak", 3400 * scale, 2.0, 4.0)
    return y + cons


def speaker(rng, female):
    """A voice's speaking pitch (Hz)."""
    return rng.uniform(175, 250) if female else rng.uniform(95, 145)


def babble_plan(rng, dur, f0, level=1.0):
    """Talk with no words: phrases of 3 to 12 syllables, random vowels, falling pitch, pauses between."""
    plan, t = [], rng.uniform(-0.5, 1.5)
    while t < dur:
        k = int(rng.integers(3, 13))
        decl = rng.uniform(0.75, 0.9)
        for j in range(k):
            length = rng.uniform(0.11, 0.26)
            p = f0 * (1 + (decl - 1) * j / k) * rng.uniform(0.92, 1.1)
            v = str(rng.choice(list(VOWELS)))
            cons = rng.choice([None, None, "s", "t", "b", "h"], p=[0.3, 0.2, 0.12, 0.18, 0.12, 0.08])
            plan.append((max(t, 0), length, v, p, p * rng.uniform(0.95, 1.04), level * rng.uniform(0.6, 1.0), cons))
            t += length + rng.uniform(0.0, 0.05)
        t += rng.uniform(0.25, 1.4)
    return plan


def babble(rng, dur, voices, level=1.0):
    out = np.zeros(int(dur * SR))
    for _ in range(voices):
        female = rng.random() < 0.4
        out += voice(rng, dur, babble_plan(rng, dur, speaker(rng, female), level), female, breath=0.1) * rng.uniform(0.5, 1.0)
    return out


def applause(rng, dur, rate, clappers_color=8):
    """Many people clapping: `rate(t)` claps a second (a numpy function of t), each a short burst of filtered noise."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    lam = rate(t) / SR
    out = np.zeros(n)
    for c in range(clappers_color):
        hits = (rng.random(n) < lam / clappers_color) * rng.uniform(0.3, 1.0, n)
        k = int(0.012 * SR)
        kern = rng.standard_normal(k) * np.exp(-np.arange(k) / (0.0025 * SR))
        kern = filt(kern, "bandpass", rng.uniform(900, 2600), rng.uniform(1.2, 2.2))
        out += fft_convolve(hits, kern)[:n]
    return out


def place(n, parts):
    out = np.zeros(n)
    for at, x, gain in parts:
        i = int(at * SR)
        if i >= n:
            continue
        m = min(len(x), n - i)
        out[i:i + m] += gain * x[:m]
    return out


def distance(x, far, seed):
    """Push a group of voices back: duller, quieter direct sound, more echo."""
    dull = filt(x, "lowpass", 3800 - 2600 * far)
    wet = fft_convolve(dull, reverb_ir(2.2, seed))[:len(x)]
    return (1 - far) * dull + (0.35 + 0.9 * far) * wet


def ambient_B():
    """About 200 voices talking with no words, far (a 40-voice babble laid four times), middle and near, over a soft
    roar; slow swells evened out; looped."""
    rng = np.random.default_rng(11)
    dur, xf = LENGTHS["ambient"], 3.0
    total = dur + xf + 0.5
    n = int(total * SR)
    # Far: many voices, dull and echoing: the stadium's wash. Made of a 40-voice babble laid four times at
    # different offsets (circularly), each a little differently colored: about 160 voices.
    base = babble(rng, total, 40, 0.8)
    far = np.zeros(n)
    for k, (shift, lp) in enumerate([(0.0, 1500), (5.3, 1300), (11.1, 1700), (17.7, 1200)]):
        far += filt(np.roll(base, int(shift * SR)), "lowpass", lp)
    far = distance(far, 0.95, 3)
    # Middle: 24 voices a little nearer.
    mid = distance(babble(rng, total, 24, 0.8), 0.6, 4)
    # Near: 10 voices a few rows round you, still under the rest, and low-passed so no word is clear.
    near = distance(filt(babble(rng, total, 10, 0.7), "lowpass", 2600), 0.3, 5)
    # The bowl's air: a soft, slowly breathing roar under the voices.
    air = filt(filt(rng.standard_normal(n), "lowpass", 900), "highpass", 120)
    air *= 1 + 0.15 * np.sin(2 * math.pi * np.arange(n) / SR / 7.3)
    mix = (far / rms(far)) * 1.0 + (mid / rms(mid)) * 0.55 + (near / rms(near)) * 0.3 + (air / rms(air)) * 0.35
    mix = steady(tilt(filt(mix, "highpass", 110), "crowd"), 1.2, 0.8)
    return loop_wrap(mix, dur, xf)


def rms(x):
    return math.sqrt(np.mean(x * x)) + 1e-12


def cheer_B():
    """70 voices shouting "yeaaah", "woooo" and "hey! hey!", synthesized applause, and talk coming back as it settles."""
    rng = np.random.default_rng(21)
    dur = LENGTHS["cheer"]
    n = int(dur * SR)
    parts = []
    for i in range(70):
        female = rng.random() < 0.4
        f0 = speaker(rng, female) * rng.uniform(1.5, 2.1)  # a cheer is pitched well above talk
        at = rng.gamma(2.0, 0.07)
        plan = []
        if rng.random() < 0.6:  # one long "yeaaah" / "woooo"
            v = [("i", "a"), ("u", "o"), ("e", "ae"), ("a", "a"), ("u", "u"), ("o", "a")][int(rng.integers(6))]
            length = rng.uniform(1.0, 2.2)
            plan.append((0.0, length, v, f0, f0 * rng.uniform(0.7, 0.9), 1.0, rng.choice([None, "h", "b"])))
        else:  # "hey! hey!" bursts
            t = 0.0
            for _ in range(int(rng.integers(2, 4))):
                length = rng.uniform(0.25, 0.45)
                plan.append((t, length, ("e", "ae"), f0 * 1.05, f0 * 0.9, 1.0, "h"))
                t += length + rng.uniform(0.08, 0.2)
        x = voice(rng, 2.6, plan, female, bright=rng.uniform(0.2, 0.5), breath=0.18)
        parts.append((at, x, rng.uniform(0.4, 1.0)))
    voices = place(n, parts)
    t = np.arange(n) / SR
    claps = applause(rng, dur, lambda t: 1600 * np.clip(t / 0.35, 0, 1) * np.exp(-np.clip(t - 0.9, 0, None) / 1.1))
    # The settle: talk rising back under it as the cheer dies.
    talk = babble(rng, dur, 16, 0.6) * np.clip((t - 1.4) / 1.2, 0, 1)
    mix = voices / rms(voices) + 0.5 * claps / rms(claps) + 0.25 * talk / (rms(talk) + 1e-9)
    mix = distance(mix, 0.45, 7)
    mix *= np.exp(-np.clip(t - 1.2, 0, None) / 1.3)  # erupts, then settles
    return fade(tilt(filt(mix, "highpass", 160), "cheer"), 0.005, 0.4)


def shocked_B():
    """A quick shared breath in, then 60 voices going "oh-ooh!" together, up a little and falling away."""
    rng = np.random.default_rng(31)
    dur = LENGTHS["shocked"]
    n = int(dur * SR)
    parts = []
    for i in range(60):
        female = rng.random() < 0.45
        f0 = speaker(rng, female) * rng.uniform(1.25, 1.6)
        at = 0.05 + rng.gamma(2.0, 0.025)  # a reaction: everyone within about a tenth of a second
        length = rng.uniform(0.7, 1.15)
        # "ooh!": from "oh" to "oo", up a little then falling away.
        plan = [(0.0, 0.22, ("o", "u"), f0 * 0.97, f0 * 1.12, 1.0, "h"),
                (0.2, length - 0.2, "u", f0 * 1.12, f0 * rng.uniform(0.68, 0.8), 0.9, None)]
        x = voice(rng, 1.4, plan, female, bright=0.15, breath=0.2)
        parts.append((at, x, rng.uniform(0.4, 1.0)))
    voices = place(n, parts)
    # A sharp breath in, just before.
    t = np.arange(n) / SR
    gasp = filt(rng.standard_normal(n), "bandpass", 1800, 0.6) * np.exp(-((t - 0.05) / 0.045) ** 2)
    mix = voices / rms(voices) + 0.6 * gasp / rms(gasp) * 0.25
    mix = distance(mix, 0.45, 8)
    mix *= np.exp(-np.clip(t - 0.55, 0, None) / 0.45)
    return fade(tilt(filt(mix, "highpass", 140), "ooh"), 0.003, 0.25)


def boo_B():
    """60 voices booing, low and not harsh ("booooo", some "boo, booooo"), sagging in pitch."""
    rng = np.random.default_rng(41)
    dur = LENGTHS["boo"]
    n = int(dur * SR)
    parts = []
    for i in range(60):
        female = rng.random() < 0.35
        f0 = speaker(rng, female) * rng.uniform(1.0, 1.25)
        at = rng.gamma(2.0, 0.1)
        plan = []
        t = 0.0
        for _ in range(1 if rng.random() < 0.6 else 2):  # "booooo" or "boo, booooo"
            length = rng.uniform(0.5, 0.8) if not plan and rng.random() < 0.4 else rng.uniform(1.1, 1.9)
            plan.append((t, length, ("oo", "u"), f0 * 1.04, f0 * rng.uniform(0.82, 0.95), 1.0, "b"))
            t += length + rng.uniform(0.1, 0.25)
        x = voice(rng, 2.6, plan, female, bright=0.05, breath=0.12)
        parts.append((at, x, rng.uniform(0.4, 1.0)))
    voices = place(n, parts)
    t = np.arange(n) / SR
    mix = distance(voices / rms(voices), 0.5, 9)
    mix *= np.clip(1.15 - 0.35 * t / dur, 0, None)
    return fade(tilt(filt(mix, "highpass", 120), "boo"), 0.01, 0.45)


# --- A: built from recordings -----------------------------------------------------------------------------------

# Every recording an A file uses: file name (as downloaded) -> where it is, who made it, its license. Looked at and
# left out: Wikimedia Commons' "Soundgoats - Audience Booing" (its page claims both CC BY-SA 4.0 and public domain,
# by an uploader who isn't Soundgoats: unclear), AuraVoice's "Cheers" (one voice; it may say a word).
OGA = "https://opengameart.org/content/"
QUENDEL = "Gregor Quendel - Crowd Cheering Sounds - "
SOURCES = {
    "oooooooooo.ogg": dict(
        title="OoOoOoOoOoOoOo", url=OGA + "oooooooooooooo", author="AuraVoice (posted by Nocturnal_Vanguard)", license="CC0 1.0"),
    "277021_sandermotions_applause-2.wav": dict(
        title="applause-2", url="https://freesound.org/people/Sandermotions/sounds/277021/ (copy: "
        "https://commons.wikimedia.org/wiki/File:277021_sandermotions_applause-2.wav)", author="Sandermotions", license="CC0 1.0"),
    QUENDEL + "03 - Strong cheering - I.mp3": dict(
        title="Free Crowd Cheering Sounds, 03 - Strong cheering - I", url=OGA + "free-crowd-cheering-sounds",
        author="Gregor Quendel", license="CC BY 4.0"),
    QUENDEL + "04 - Strong cheering - II - Short.mp3": dict(
        title="Free Crowd Cheering Sounds, 04 - Strong cheering - II - Short", url=OGA + "free-crowd-cheering-sounds",
        author="Gregor Quendel", license="CC BY 4.0"),
    QUENDEL + "10 - Ambience.mp3": dict(
        title="Free Crowd Cheering Sounds, 10 - Ambience", url=OGA + "free-crowd-cheering-sounds",
        author="Gregor Quendel", license="CC BY 4.0"),
}


def src(name):
    hits = glob.glob(os.path.join(glob.escape(ARGS.sources), "**", glob.escape(name)), recursive=True)
    if not hits:
        sys.exit(f"{name} not found under {ARGS.sources}: download it from {SOURCES[name]['url']}")
    return load(hits[0])


def cut(x, start, length):
    return fit(x[int(start * SR):], length)


def bend(x, semis):
    """Play `x` with its pitch following `semis` (a function of the output's time in seconds), length changing with it."""
    t = np.arange(int(len(x) * 2)) / SR
    pos = np.concatenate([[0], np.cumsum(2 ** (semis(t) / 12))])[:-1]
    pos = pos[pos < len(x) - 1]
    return np.interp(pos, np.arange(len(x)), x)


def shocked_A():
    """
    AuraVoice's one sung "oooo" made into a crowd's "ooh!": 36 copies of its steady middle, each its own voice
    (pitched -6 to +6 semitones), each bent as a gasped "ooh" goes (up a little, then falling away), all starting within
    about a tenth of a second, some farther off than others, with the stadium echo, EQ'd brighter (one sung "oo" is darker than a crowd's "ooh").
    """
    rng = np.random.default_rng(51)
    dur = LENGTHS["shocked"]
    n = int(dur * SR)
    oo = cut(src("oooooooooo.ogg"), 0.15, 1.3)
    copies = []
    for i in range(36):
        base = rng.uniform(-6, 6)
        rise, fall = rng.uniform(1.0, 2.5), rng.uniform(4.0, 7.0)
        semis = lambda t, b=base, r=rise, f=fall: b + r * np.clip(t / 0.18, 0, 1) - f * np.clip((t - 0.18) / 0.9, 0, 1)
        x = bend(oo, semis)[: int(1.2 * SR)]
        m = len(x)
        tt = np.arange(m) / SR
        env = np.clip(tt / rng.uniform(0.03, 0.07), 0, 1) * np.exp(-np.clip(tt - 0.2, 0, None) / rng.uniform(0.25, 0.45))
        x = filt(x * env, "lowpass", rng.uniform(2500, 6000))
        copies.append((0.03 + rng.gamma(2.0, 0.025), x, rng.uniform(0.35, 1.0)))
    mix = place(n, copies)
    mix = distance(mix / rms(mix), 0.45, 8)
    t = np.arange(n) / SR
    mix *= np.exp(-np.clip(t - 0.6, 0, None) / 0.45)
    return fade(tilt(filt(mix, "highpass", 140), "ooh"), 0.003, 0.25)


def boo_A():
    """
    The same sung "oooo" made into a crowd's long "booo": 40 copies, lower than the gasp (-9 to +2 semitones), each
    swelling in over about a tenth of a second and sagging in pitch as a boo does, started over the first half second
    (some booing twice: a short "boo" then a long one), some farther off, with the stadium echo and boo-B's EQ.
    """
    rng = np.random.default_rng(52)
    dur = LENGTHS["boo"]
    n = int(dur * SR)
    oo = cut(src("oooooooooo.ogg"), 0.15, 1.75)
    copies = []
    for i in range(40):
        base = rng.uniform(-9, 2)
        at = rng.gamma(2.0, 0.1)
        for length in ([rng.uniform(0.35, 0.55), rng.uniform(1.1, 1.6)] if rng.random() < 0.3 else [rng.uniform(1.3, 2.1)]):
            sag = rng.uniform(1.5, 3.5)
            semis = lambda t, b=base, s=sag, L=length: b + 0.6 * np.clip(t / 0.1, 0, 1) - s * np.clip(t / L, 0, 1)
            x = bend(oo, semis)[: int(length * SR)]
            m = len(x)
            tt = np.arange(m) / SR
            env = np.clip(tt / rng.uniform(0.06, 0.14), 0, 1) * np.clip((m / SR - tt) / 0.25, 0, 1)
            x = filt(x * env, "lowpass", rng.uniform(2000, 5000))
            copies.append((at, x, rng.uniform(0.35, 1.0)))
            at += length + rng.uniform(0.08, 0.2)
    mix = place(n, copies)
    mix = distance(mix / rms(mix), 0.5, 9)
    t = np.arange(n) / SR
    mix *= np.clip(1.15 - 0.35 * t / dur, 0, None)
    return fade(tilt(filt(mix, "highpass", 120), "boo"), 0.01, 0.45)


def cheer_A():
    """
    Gregor Quendel's strong cheering (a big crowd; CC BY 4.0): track 04 from just before its loudest, made to burst in
    (a 0.12 s rise) and settle over three seconds, with track 03's peak under it a beat later and sandermotions'
    applause (CC0) for the hands.
    """
    dur = LENGTHS["cheer"]
    n = int(dur * SR)
    a = cut(src(QUENDEL + "04 - Strong cheering - II - Short.mp3"), 5.2, dur)
    b = cut(src(QUENDEL + "03 - Strong cheering - I.mp3"), 6.4, dur)
    c = cut(src("277021_sandermotions_applause-2.wav"), 1.2, dur)
    mix = place(n, [(0.0, a / rms(a), 1.0), (0.08, b / rms(b), 0.6), (0.05, c / rms(c), 0.35)])
    t = np.arange(n) / SR
    mix *= np.exp(-np.clip(t - 1.0, 0, None) / 1.1)
    return fade(filt(mix, "highpass", 150), 0.12, 0.4)


def ambient_A():
    """
    Gregor Quendel's crowd ambience (CC BY 4.0): its steady 27 s (3 to 30 s, between its fades), with a second layer
    of itself played 8% slower (a little lower: other people), farther off, so the crowd is bigger and nothing
    repeats in step; slow swells evened out, EQ'd to a stadium's murmur, and its last 3 s crossfaded into its start
    so it loops with no seam.
    """
    dur, xf = LENGTHS["ambient"], 3.0
    n = int((dur + xf) * SR)
    a = cut(src(QUENDEL + "10 - Ambience.mp3"), 3.0, dur + xf)
    b = filt(fit(resample(cut(src(QUENDEL + "10 - Ambience.mp3"), 3.0, 27.0), 0.92)[int(1.3 * SR):], dur + xf), "lowpass", 1800)
    mix = place(n, [(0.0, a / rms(a), 1.0), (0.0, b / rms(b), 0.5)])
    mix = distance(mix, 0.25, 6)
    mix = steady(tilt(filt(mix, "highpass", 110), "crowd"), 1.2, 0.8)
    return loop_wrap(mix, dur, xf)


MAKERS_A = {"ambient-A": ambient_A, "cheer-A": cheer_A, "shocked-A": shocked_A, "boo-A": boo_A}
MAKERS_B = {"ambient-B": ambient_B, "cheer-B": cheer_B, "shocked-B": shocked_B, "boo-B": boo_B}


# --- Out --------------------------------------------------------------------------------------------------------

def encode(x, path):
    pcm = np.clip(x, -1, 1).astype("<f4").tobytes()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "libmp3lame", "-b:a", "96k", path],
        input=pcm, check=True,
    )


def level(name, x, target):
    kind = name.split("-")[0]
    want = target + LEVELS[kind]
    x = x * 10 ** ((want - loudness(x)) / 20)
    peak = 20 * math.log10(np.abs(x).max())
    if peak > -1:
        sys.exit(f"{name}: peak {peak:.1f} dBFS after leveling (would clip)")
    return x, want


def main():
    os.makedirs(ARGS.out, exist_ok=True)
    target = loudness(load(os.path.join(SOUNDS, "move.mp3")))
    makers = dict(MAKERS_B)
    if ARGS.sources:
        makers = {**MAKERS_A, **makers}
    for name in sorted(makers):
        if ARGS.names and name not in ARGS.names:
            continue
        x = makers[name]()
        x, want = level(name, x, target)
        path = os.path.join(ARGS.out, f"{name}.mp3")
        encode(x, path)
        miss = want - loudness(load(path))  # the mp3 shifts it a little: level what's heard, once more
        if abs(miss) > 0.05:
            x *= 10 ** (miss / 20)
            encode(x, path)
        got = load(path)
        print(f"{name:11s} {len(x) / SR:5.2f} s  peak {20 * math.log10(np.abs(got).max()):5.1f} dBFS  loudest 30 ms {loudness(got):5.1f} dB"
              f" (move {target:.1f})  mean {mean_loudness(got):5.1f} dB  {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--sources")
    p.add_argument("names", nargs="*")
    ARGS = p.parse_args()
    main()
