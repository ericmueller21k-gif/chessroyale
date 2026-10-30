"""
The Colosseum's crowd (Eric, Oct 30: "steady background layered chatter like you'd hear watching a FIFA World Cup
game", "sword clanging once in a while, and maybe shield blocking"). Not wired into the game yet.

What Eric kept from the first candidates (Oct 30): ambient B (his favorite, "a little faint": now more chatter, cleaner)
and cheer A. Shocked, boo and cheer B were dropped (in git history: commit 7ae46b82).

- The bed: two seamless loops of different lengths (24 s and 31 s) played together, each at -3 dB, so the pair only
  repeats every 744 s (12.4 minutes; LCM of 24 and 31) and neither loop's seam is heard on its own. B: made here from
  nothing (~250 voices talking with no words, near and far, with a synthetic stadium echo); A: Gregor Quendel's
  recorded crowd (CC BY 4.0), 24 s and 29 s (its steady part is only 27 s long).
- The clangs: 8 one-shots from the arena floor, made here (modal synthesis: inharmonic partials with a noise
  transient, then a stadium echo): 5 sword on sword (bright, ringing) and 3 sword on shield (a duller body knock).
  The game plays one every 3 to 7 s at random: a random one (never the same twice running), -4 to 0 dB, panned a
  little left or right.
- cheer-A: Quendel's strong cheering with Sandermotions' applause (CC0), erupting and settling (3.5 s).
- ambient-mix-A, ambient-mix-B: 90 s previews of that scheme (stereo), for Eric to hear what the game would play.

Leveled as the game levels its sounds (piece-sounds.py's `loudness`: the loudest 30 ms through a phone speaker's
200 Hz high-pass and the game's 6 kHz low-pass), relative to a move (sounds/move.mp3): LEVELS. mp3, mono, 96 kb/s.

    # the recordings for the A files, in one folder (each file's URL is in SOURCES below):
    python3 scripts/crowd-sounds.py --out <dir> --sources <src dir> [name ...]   # everything
    python3 scripts/crowd-sounds.py --out <dir> [name ...]                       # ours only (no download needed)
    # names: ambient-B, ambient-B-2, clang-sword-1, ..., ambient-mix-B (default: all). Needs numpy, scipy and ffmpeg.
"""
import argparse, glob, math, os, subprocess, sys
import numpy as np
from scipy.signal import lfilter

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
SOUNDS = os.path.join(HERE, "../packages/app/public/sounds")

# dB relative to a move's loudness (the loudest 30 ms, as `loudness` measures it).
LEVELS = {"ambient": -12.0, "cheer": 0.0, "clang": -3.0}
LENGTHS = {"cheer": 3.5}
BEDS = {"": 24.0, "-2": 31.0}  # the two loops of a bed (file suffix: seconds); A's second is 29 s (see ambient_A)


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
# The long-term spectrum (dB an octave band, the loudest band 0) a crowd's murmur should have, from the textbook
# shape of speech heard at a distance: it peaks near 500 Hz to 1 kHz and falls off above.
TILTS = {
    "crowd": (-12, -2, 0, -5, -14, -24),
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


def glottal(f0, rng, breath=0.08):
    """A voice's buzz at f0 (one value a sample): a sawtooth (falls 6 dB an octave, as a voice's source and lips do),
    band-limited (polyBLEP: no aliasing hiss), a little jitter, and breath noise pulsing with it."""
    jitter = 1 + 0.03 * filt(rng.standard_normal(len(f0)), "lowpass", 30)
    dt = f0 * jitter / SR
    frac = np.cumsum(dt) % 1.0
    saw = 2 * frac - 1
    lo, hi = frac < dt, frac > 1 - dt
    x = np.where(lo, frac / dt, 0.0)
    saw -= np.where(lo, 2 * x - x * x - 1, 0.0)
    x = np.where(hi, (frac - 1) / dt, 0.0)
    saw -= np.where(hi, x * x + 2 * x + 1, 0.0)
    noise = rng.standard_normal(len(f0)) * (0.6 + 0.4 * np.cos(2 * math.pi * frac))
    return -saw + breath * filt(noise, "highpass", 1200)


def per_block(track):
    """A per-sample track sampled once a BLOCK."""
    return track[::BLOCK]


def voice(rng, dur, plan, female, breath=0.08):
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
    src = glottal(f0s, rng, breath)
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


def ambient_B(dur, seed):
    """
    About 250 voices talking with no words over a faint roar; a loop `dur` s long. Far: a 40-voice babble laid four
    times at different offsets, dull and echoing (the stadium's wash); middle: 36 voices; near: 14 a few rows round
    you, low-passed so no word is clear. Since Eric's "a little faint" (Oct 30): the middle and near chatter up
    against the wash and the roar, less echo on them, the roar halved, a band-limited buzz (cleaner), and the
    leveling gentler.
    """
    rng = np.random.default_rng(seed)
    xf = 3.0
    total = dur + xf + 0.5
    n = int(total * SR)
    base = babble(rng, total, 40, 0.8)
    far = np.zeros(n)
    for shift, lp in [(0.0, 1500), (5.3, 1300), (11.1, 1700), (17.7, 1200)]:
        far += filt(np.roll(base, int(shift * SR)), "lowpass", lp)
    far = distance(far, 0.95, seed + 3)
    mid = distance(babble(rng, total, 36, 0.8), 0.45, seed + 4)
    near = distance(filt(babble(rng, total, 14, 0.7), "lowpass", 2600), 0.2, seed + 5)
    air = filt(filt(rng.standard_normal(n), "lowpass", 900), "highpass", 120)
    air *= 1 + 0.15 * np.sin(2 * math.pi * np.arange(n) / SR / 7.3)
    mix = (far / rms(far)) * 0.7 + (mid / rms(mid)) * 1.0 + (near / rms(near)) * 0.55 + (air / rms(air)) * 0.15
    mix = steady(tilt(filt(mix, "highpass", 110), "crowd"), 1.5, 0.6)
    return loop_wrap(mix, dur, xf)


def rms(x):
    return math.sqrt(np.mean(x * x)) + 1e-12


# --- The clangs: made here --------------------------------------------------------------------------------------

def modes(n, parts, rng):
    """A struck body: `parts` are (frequency Hz, level, seconds to fall 60 dB); each sounds as a pair a few Hz apart,
    so it beats a little as real metal does."""
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f, a, t60 in parts:
        if f > SR / 2 - 500:
            continue
        d = rng.uniform(0.5, 4.0)
        ph = rng.uniform(0, 2 * math.pi, 2)
        y += a * (np.sin(2 * math.pi * f * t + ph[0]) + 0.6 * np.sin(2 * math.pi * (f + d) * t + ph[1])) * np.exp(-6.91 * t / t60)
    return y


def blade(rng, n, ring=1.0, damp=1.0):
    """A sword blade's ring: a free bar's inharmonic modes (1 : 2.76 : 5.40 : 8.93 : 13.34) and a few random high
    partials, the higher ones dying sooner. `damp` < 1 shortens it (a blade pressed against a shield)."""
    f1 = rng.uniform(330, 560)
    parts = []
    for k, r in enumerate((1.0, 2.756, 5.404, 8.933, 13.344)):
        f = f1 * r * rng.uniform(0.985, 1.015)
        parts.append((f, rng.uniform(0.3, 1.0) * (1.0 if 1500 < f < 5000 else 0.45), damp * ring * 1.7 * (f1 / f) ** 0.35))
    for _ in range(4):
        f = rng.uniform(2400, 7500)
        parts.append((f, rng.uniform(0.15, 0.45), damp * ring * rng.uniform(0.25, 0.7)))
    return modes(n, parts, rng)


def hit(rng, n, bright=1.0):
    """The strike itself: a 2 ms click and a short scrape of filtered noise."""
    t = np.arange(n) / SR
    click = filt(rng.standard_normal(n), "highpass", 2000) * np.exp(-t / 0.0015)
    scrape = filt(rng.standard_normal(n), "bandpass", rng.uniform(3000, 5500) * bright, 0.9) * np.exp(-t / rng.uniform(0.012, 0.03))
    return 1.4 * click + 0.8 * scrape


def arena(x, seed, far=0.4):
    """From the arena floor: a little dulled and quieter than it's echo, in the stadium's bowl."""
    dry = filt(x, "lowpass", 6500 - 2500 * far)
    wet = fft_convolve(dry, reverb_ir(2.2, seed, damp_hz=2500, predelay=0.035))[:len(x)]
    return (1 - far) * dry + (0.5 + 1.2 * far) * wet * rms(dry) / (rms(wet[: len(dry)]) + 1e-12) * 0.6


def sword(seed, double=False, scrape=False):
    """Sword on sword: a bright, ringing clash (`double`: two blows 0.1 to 0.2 s apart; `scrape`: the blades slide
    off each other, a rising hiss)."""
    rng = np.random.default_rng(seed)
    length = 1.8
    n = int(length * SR)
    x = hit(rng, n) + 0.5 * blade(rng, n) + 0.35 * blade(rng, n, ring=0.8)
    if double:
        k = int(rng.uniform(0.1, 0.2) * SR)
        y = hit(rng, n, 1.1) + 0.45 * blade(rng, n, 0.9) + 0.3 * blade(rng, n, 0.7)
        x[k:] += 0.8 * y[: n - k]
    if scrape:
        m = int(0.25 * SR)
        t = np.arange(m) / SR
        hiss = rng.standard_normal(m) * np.sin(math.pi * t / t[-1]) ** 2
        hiss = filt(hiss, "bandpass", 4200, 1.5) + 0.5 * filt(hiss, "bandpass", 6200, 2.0)
        k = int(0.03 * SR)
        x[k:k + m] += 0.25 * hiss
    return fade(arena(x, seed + 100, 0.4), 0.0005, 0.3)


def shield(seed, heavy=False):
    """Sword on shield: a dull knock of the shield's wooden body (low modes dying fast, a thump of noise), with the
    blade's ring short and quieter (pressed against the shield). `heavy`: a bigger, lower shield."""
    rng = np.random.default_rng(seed)
    length = 1.4
    n = int(length * SR)
    t = np.arange(n) / SR
    low = rng.uniform(0.7, 0.85) if heavy else 1.0
    body = modes(n, [(f * low * rng.uniform(0.95, 1.05), a, d) for f, a, d in
                     ((210, 0.8, 0.16), (340, 1.0, 0.12), (520, 0.8, 0.09), (780, 0.5, 0.07), (1150, 0.3, 0.05))], rng)
    thump = filt(rng.standard_normal(n), "lowpass", 1000 * low) * np.exp(-t / 0.018)
    boss = modes(n, [(rng.uniform(1100, 1600) * r, 0.3, 0.35) for r in (1.0, 2.31, 3.9)], rng)  # the metal rim/boss
    x = 1.1 * body + 1.4 * thump + 0.5 * boss + 0.5 * hit(rng, n, 0.7) + 0.22 * blade(rng, n, damp=0.3)
    return fade(arena(filt(x, "highpass", 120), seed + 200, 0.4), 0.0005, 0.25)


CLANGS = {
    "clang-sword-1": lambda: sword(1),
    "clang-sword-2": lambda: sword(2, double=True),
    "clang-sword-3": lambda: sword(3, scrape=True),
    "clang-sword-4": lambda: sword(4),
    "clang-sword-5": lambda: sword(5, double=True, scrape=True),
    "clang-shield-1": lambda: shield(6),
    "clang-shield-2": lambda: shield(7, heavy=True),
    "clang-shield-3": lambda: shield(8),
}


# --- A: built from recordings -----------------------------------------------------------------------------------

# Every recording an A file uses: file name (as downloaded) -> where it is, who made it, its license.
OGA = "https://opengameart.org/content/"
QUENDEL = "Gregor Quendel - Crowd Cheering Sounds - "
SOURCES = {
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


def ambient_A(dur, speed):
    """
    Gregor Quendel's crowd ambience (CC BY 4.0): its steady 27 s (3 to 30 s, between its fades) played at `speed`
    (the second loop slower and a little lower, so it isn't the first one again), with a second layer of itself
    another 8% slower and farther off, so the crowd is bigger and nothing repeats in step; slow swells evened out,
    EQ'd to a stadium's murmur, and its last 2.5 s crossfaded into its start so it loops with no seam.
    """
    xf = 2.5
    n = int((dur + xf) * SR)
    raw = cut(src(QUENDEL + "10 - Ambience.mp3"), 3.0, 27.0)
    a = fit(resample(raw, speed), dur + xf)
    b = filt(fit(resample(raw, speed * 0.92)[int(1.3 * SR):], dur + xf), "lowpass", 1800)
    mix = place(n, [(0.0, a / rms(a), 1.0), (0.0, b / rms(b), 0.5)])
    mix = distance(mix, 0.25, 6)
    mix = steady(tilt(filt(mix, "highpass", 110), "crowd"), 1.2, 0.8)
    return loop_wrap(mix, dur, xf)


MAKERS_A = {"ambient-A": lambda: ambient_A(24.0, 1.0), "ambient-A-2": lambda: ambient_A(29.0, 0.85), "cheer-A": cheer_A}
MAKERS_B = {"ambient-B": lambda: ambient_B(BEDS[""], 11), "ambient-B-2": lambda: ambient_B(BEDS["-2"], 12), **CLANGS}


# --- Out --------------------------------------------------------------------------------------------------------

def encode(x, path, channels=1):
    pcm = np.clip(x, -1, 1).astype("<f4").tobytes()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", str(channels), "-i", "-", "-c:a", "libmp3lame", "-b:a", "96k", path],
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


PREVIEW = 90.0


def preview(bed, seed=7):
    """
    What the game would play, for PREVIEW s, in stereo: the bed's two loops at once (each at -3 dB; the second from a
    random point), and a clang every 3 to 7 s: a random one, never the same twice running, -4 to 0 dB, panned up to
    0.4 left or right (equal power, as Web Audio's StereoPannerNode).
    """
    rng = np.random.default_rng(seed)
    n = int(PREVIEW * SR)
    loops = [load(os.path.join(ARGS.out, f"ambient-{bed}{k}.mp3")) for k in BEDS]
    mono = np.zeros(n)
    for i, x in enumerate(loops):
        start = int(rng.uniform(0, len(x))) if i else 0
        mono += 10 ** (-3 / 20) * np.resize(np.roll(x, -start), n)
    out = np.stack([mono, mono], axis=1)
    clangs = {k: load(os.path.join(ARGS.out, f"{k}.mp3")) for k in CLANGS}
    t, last = rng.uniform(1.0, 3.0), None
    while t < PREVIEW - 2:
        name = str(rng.choice([k for k in clangs if k != last]))
        x = clangs[name] * 10 ** (rng.uniform(-4, 0) / 20)
        pan = rng.uniform(-0.4, 0.4)
        a = (pan + 1) * math.pi / 4
        i = int(t * SR)
        m = min(len(x), n - i)
        out[i:i + m, 0] += math.cos(a) * x[:m]
        out[i:i + m, 1] += math.sin(a) * x[:m]
        last = name
        t += rng.uniform(3.0, 7.0)
    out[:, 0] = fade(out[:, 0], 1.0, 2.0)
    out[:, 1] = fade(out[:, 1], 1.0, 2.0)
    return out


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
        print(f"{name:14s} {len(x) / SR:5.2f} s  peak {20 * math.log10(np.abs(got).max()):5.1f} dBFS  loudest 30 ms {loudness(got):5.1f} dB"
              f" (move {target:.1f})  mean {mean_loudness(got):5.1f} dB  {os.path.getsize(path) // 1024} KB")
    for bed in ("A", "B") if ARGS.sources else ("B",):
        name = f"ambient-mix-{bed}"
        if ARGS.names and name not in ARGS.names:
            continue
        path = os.path.join(ARGS.out, f"{name}.mp3")
        encode(preview(bed).reshape(-1), path, channels=2)
        print(f"{name:14s} {PREVIEW:5.2f} s  stereo preview  {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--sources")
    p.add_argument("names", nargs="*")
    ARGS = p.parse_args()
    main()
