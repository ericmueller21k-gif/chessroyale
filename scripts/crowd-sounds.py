"""
The Colosseum's sounds (packages/app/public/sounds/colosseum/; credits in its CREDITS.md):

- ambient.mp3: Eric's "Gladiator arena ambience" (an hour, royalty free, supplied by Eric, Oct 31), made fit for the
  game: its loud clangs and thumps pulled down toward the crowd ("the highs need to come down … so they don't get as
  loud"), a gentle high-shelf cut so the clangs sound duller and farther, mono, 22.05 kHz, 40 kb/s CBR (about 18 MB
  for the hour: a constant bitrate so the game can start it anywhere with a Range request), and no cover image.
  Leveled as an ambient bed: its average 15 dB under a move, quiet enough to talk over.
- cheer.mp3: a crowd erupting and settling (3.5 s, a queen taken): Gregor Quendel's strong cheering (CC BY 4.0) with
  Sandermotions' applause (CC0).

The first round's candidates (our synthesized beds, clangs, gasp and boo) are in git history: commits 7ae46b82 and
c02749b8.

Leveled as the game levels its sounds (piece-sounds.py's `loudness`: the loudest 30 ms through a phone speaker's
200 Hz high-pass and the game's 6 kHz low-pass), relative to a move (sounds/move.mp3).

    # the recordings in one folder (Gladiator.mp3 from Eric; the others' URLs are in SOURCES below):
    python3 scripts/crowd-sounds.py --sources <dir> [ambient] [cheer] [--out <dir>]
    # Needs numpy, scipy and ffmpeg. The hour takes a few minutes and about 4 GB of memory.
"""
import argparse, glob, math, os, subprocess, sys
import numpy as np
from scipy.signal import lfilter

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
SOUNDS = os.path.join(HERE, "../packages/app/public/sounds")


# --- Shared tools (the measure is piece-sounds.py's, the filters RBJ's) -----------------------------------------

def load(path, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-map", "0:a", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def biquad_ba(kind, f, q=0.707, db=0.0, sr=SR):
    """RBJ biquad coefficients (the shapes of Web Audio's BiquadFilterNode)."""
    w = 2 * math.pi * f / sr
    c, s = math.cos(w), math.sin(w)
    a = s / (2 * q)
    if kind == "lowpass":
        b, den = [(1 - c) / 2, 1 - c, (1 - c) / 2], [1 + a, -2 * c, 1 - a]
    elif kind == "highpass":
        b, den = [(1 + c) / 2, -(1 + c), (1 + c) / 2], [1 + a, -2 * c, 1 - a]
    elif kind == "highshelf":  # slope 1
        A = 10 ** (db / 40)
        r = 2 * math.sqrt(A) * s / 2 * math.sqrt(2)
        b = [A * ((A + 1) + (A - 1) * c + r), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - r)]
        den = [(A + 1) - (A - 1) * c + r, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - r]
    else:
        raise ValueError(kind)
    return np.array(b) / den[0], np.array(den) / den[0]


def filt(x, kind, f, q=0.707, db=0.0, sr=SR):
    b, a = biquad_ba(kind, f, q, db, sr)
    return lfilter(b, a, x)


def phone(x, sr=SR):
    """As a phone plays it in the game: high-passed at 200 Hz, low-passed at 6 kHz."""
    return filt(filt(x, "highpass", 200, sr=sr), "lowpass", 6000, sr=sr)


def loudness(x, sr=SR):
    """The loudest 30 ms (RMS, dB) as a phone plays it in the game."""
    y = phone(x, sr)
    w = int(0.03 * sr)
    p = np.convolve(y * y, np.ones(w) / w, mode="valid") if len(y) > w else np.array([np.mean(y * y)])
    return 10 * math.log10(max(p.max(), 1e-12))


def windows(x, sr, seconds=0.03):
    """Each 30 ms window's loudness (RMS, dB) as a phone plays it in the game."""
    y = phone(x, sr)
    w = int(seconds * sr)
    m = len(y) // w
    return 10 * np.log10((y[: m * w].reshape(m, w) ** 2).mean(1) + 1e-12)


def mean_loudness(x, sr=SR):
    """The whole sound's RMS (dB) through the same phone filters: how loud a bed sits."""
    y = phone(x, sr)
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


def cut(x, start, length):
    return fit(x[int(start * SR):], length)


def place(n, parts):
    """Mixes (start s, sound, gain) into `n` samples."""
    out = np.zeros(n)
    for at, x, gain in parts:
        i = int(at * SR)
        if i >= n:
            continue
        m = min(len(x), n - i)
        out[i:i + m] += gain * x[:m]
    return out


def rms(x):
    return math.sqrt(np.mean(x * x)) + 1e-12


# --- The recordings ---------------------------------------------------------------------------------------------

# file name (as supplied or downloaded) -> where it is, who made it, its license (credits: sounds/colosseum/CREDITS.md).
OGA = "https://opengameart.org/content/"
QUENDEL = "Gregor Quendel - Crowd Cheering Sounds - "
SOURCES = {
    "Gladiator.mp3": dict(title="Gladiator arena ambience", url="supplied by Eric (Oct 31, 2026)", author="", license="royalty free"),
    "277021_sandermotions_applause-2.wav": dict(
        title="applause-2", url="https://freesound.org/people/Sandermotions/sounds/277021/ (copy: "
        "https://commons.wikimedia.org/wiki/File:277021_sandermotions_applause-2.wav)", author="Sandermotions", license="CC0 1.0"),
    QUENDEL + "03 - Strong cheering - I.mp3": dict(
        title="Free Crowd Cheering Sounds, 03 - Strong cheering - I", url=OGA + "free-crowd-cheering-sounds",
        author="Gregor Quendel", license="CC BY 4.0"),
    QUENDEL + "04 - Strong cheering - II - Short.mp3": dict(
        title="Free Crowd Cheering Sounds, 04 - Strong cheering - II - Short", url=OGA + "free-crowd-cheering-sounds",
        author="Gregor Quendel", license="CC BY 4.0"),
}


def src(name, sr=SR):
    hits = glob.glob(os.path.join(glob.escape(ARGS.sources), "**", glob.escape(name)), recursive=True)
    if not hits:
        sys.exit(f"{name} not found under {ARGS.sources}: {SOURCES[name]['url']}")
    return load(hits[0], sr)


# --- The cheer --------------------------------------------------------------------------------------------------

def cheer():
    """
    Gregor Quendel's strong cheering (a big crowd; CC BY 4.0): track 04 from just before its loudest, made to burst in
    (a 0.12 s rise) and settle over three seconds, with track 03's peak under it a beat later and Sandermotions'
    applause (CC0) for the hands. Leveled to a move.
    """
    dur = 3.5
    n = int(dur * SR)
    a = cut(src(QUENDEL + "04 - Strong cheering - II - Short.mp3"), 5.2, dur)
    b = cut(src(QUENDEL + "03 - Strong cheering - I.mp3"), 6.4, dur)
    c = cut(src("277021_sandermotions_applause-2.wav"), 1.2, dur)
    mix = place(n, [(0.0, a / rms(a), 1.0), (0.08, b / rms(b), 0.6), (0.05, c / rms(c), 0.35)])
    t = np.arange(n) / SR
    mix *= np.exp(-np.clip(t - 1.0, 0, None) / 1.1)
    return fade(filt(mix, "highpass", 150), 0.12, 0.4)


# --- The ambient ------------------------------------------------------------------------------------------------

AMB_SR = 22050  # what it's stored at: the game low-passes everything at 6 kHz anyway
AMB_KBPS = 40  # CBR: ~18 MB for the hour (Cloudflare's cap is 25 MiB a file)
AMB_UNDER = 15.0  # its average, dB under a move's loudest 30 ms
CROSSOVER = 2000  # Hz: the clangs' ring lives above it, the crowd's voices mostly below


def gain_curve(level_db, threshold, ratio, block_s, release_s, ahead=2):
    """
    A compressor's gain (dB, <= 0) a block: above `threshold` the level rises 1/`ratio` as fast. The gain falls at once
    (`ahead` blocks early, so a clang's first edge is caught) and recovers over `release_s`.
    """
    over = np.maximum(level_db - threshold, 0) * (1 - 1 / ratio)
    want = over.copy()
    for k in range(1, ahead + 1):
        want[:-k] = np.maximum(want[:-k], over[k:])
    keep = math.exp(-block_s / release_s)
    gr = np.empty_like(want)
    g = 0.0
    for i, w in enumerate(want.tolist()):
        g = w if w > g else g * keep
        gr[i] = g
    return -gr


def apply_gain(x, gain_db, block):
    """Spreads a per-block gain (dB) over the samples, linearly between block centers."""
    centers = np.arange(len(gain_db)) * block + block / 2
    return x * 10 ** (np.interp(np.arange(len(x)), centers, gain_db) / 20)


def block_peaks(x, block):
    m = len(x) // block
    p = np.abs(x[: m * block]).reshape(m, block).max(1)
    if len(x) > m * block:
        p = np.append(p, np.abs(x[m * block:]).max())
    return 20 * np.log10(p + 1e-9)


def ambient():
    """
    Eric's hour of arena ambience, its clangs tamed:
    1. Mono, 22.05 kHz; a 60 Hz high-pass (rumble no phone plays).
    2. Above 2 kHz (where the clangs ring), a fast compressor: 1 ms blocks, from 6 dB over that band's median level,
       6 : 1, recovering over 0.15 s. Below 2 kHz (most of the crowd's voices) is left as it was.
    3. A gentle high shelf: -5 dB above about 3 kHz (duller, farther clangs).
    4. The whole: 5 ms blocks, from 8 dB over the median, 3 : 1, recovering over 0.3 s (the thumps and the loudest
       moments pulled toward the rest).
    5. Leveled (in main): its average AMB_UNDER dB under a move; AMB_KBPS kb/s CBR, no tags or cover image.
    """
    sr = AMB_SR
    x = src("Gladiator.mp3", sr)
    before = windows(x, sr)
    x = filt(x, "highpass", 60, sr=sr)
    low = filt(filt(x, "lowpass", CROSSOVER, sr=sr), "lowpass", CROSSOVER, sr=sr)  # Linkwitz-Riley, 24 dB an octave
    high = x - low  # low + high is exactly x again
    b1 = int(0.001 * sr)
    lv = block_peaks(high, b1)
    high = apply_gain(high, gain_curve(lv, np.median(lv) + 6, 6.0, 0.001, 0.15, ahead=3), b1)
    x = filt(low + high, "highshelf", 3000, db=-5.0, sr=sr)
    del low, high
    b5 = int(0.005 * sr)
    lv = block_peaks(x, b5)
    x = apply_gain(x, gain_curve(lv, np.median(lv) + 8, 3.0, 0.005, 0.3), b5)
    after = windows(x, sr)
    for name, w in (("before", before), ("after", after)):
        m = np.median(w)
        print(f"ambient {name:6s} 30 ms loudness over its median: 99th {np.percentile(w, 99) - m:+.1f}, "
              f"99.9th {np.percentile(w, 99.9) - m:+.1f}, top {w.max() - m:+.1f} dB")
    return x


def encode(x, path, sr=SR, kbps=96):
    pcm = np.clip(x, -1, 1).astype("<f4").tobytes()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-", "-map_metadata", "-1",
         "-c:a", "libmp3lame", "-b:a", f"{kbps}k", path],
        input=pcm, check=True,
    )


def main():
    out = ARGS.out or os.path.join(SOUNDS, "colosseum")
    os.makedirs(out, exist_ok=True)
    target = loudness(load(os.path.join(SOUNDS, "move.mp3")))
    names = ARGS.names or ["cheer", "ambient"]
    if "cheer" in names:
        x = cheer()
        path = os.path.join(out, "cheer.mp3")
        x *= 10 ** ((target - loudness(x)) / 20)
        encode(x, path)
        x *= 10 ** ((target - loudness(load(path))) / 20)  # the mp3 shifts it a little: level what's heard, once more
        if 20 * math.log10(np.abs(x).max()) > -1:
            sys.exit("cheer: would clip")
        encode(x, path)
        print(f"cheer    {len(x) / SR:.2f} s  loudest 30 ms {loudness(load(path)):.1f} dB (move {target:.1f})  {os.path.getsize(path) // 1024} KB")
    if "ambient" in names:
        sr = AMB_SR
        x = ambient()
        x *= 10 ** ((target - AMB_UNDER - mean_loudness(x, sr)) / 20)
        peak = 20 * math.log10(np.abs(x).max())
        if peak > -1:
            sys.exit(f"ambient: peak {peak:.1f} dBFS (would clip)")
        path = os.path.join(out, "ambient.mp3")
        encode(x, path, sr, AMB_KBPS)
        w = windows(x, sr)
        print(f"ambient  {len(x) / sr / 60:.1f} min  mean {mean_loudness(x, sr):.1f} dB (move {target:.1f})  loudest 30 ms:"
              f" 99.9th {np.percentile(w, 99.9):.1f}, top {w.max():.1f} dB  peak {peak:.1f} dBFS  {os.path.getsize(path) / 1e6:.1f} MB")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--sources", required=True)
    p.add_argument("--out")
    p.add_argument("names", nargs="*")
    ARGS = p.parse_args()
    main()
