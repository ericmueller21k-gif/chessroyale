"""
The piece sounds (Settings: Move sound, Capture sound; castling): makes every file in packages/app/public/sounds/pieces/.
Every option is wood (Eric, Oct 12: "slightly different wooden sounds, not chips or clicks"), from Kenney's CC0
*Impact Sounds* or made here (ours, no licence needed). The defaults: "Light wood" (move) and "Heavy wood" (capture);
castling is two Light wood knocks, king then rook.

Every file is trimmed to start on its hit (so it lands with the piece), faded out, and levelled to the loudness the
game's knocks have always had: the loudest 30 ms, heard through a phone speaker (high-passed at 200 Hz) and the game's
own 6 kHz low-pass (TARGET, below: measured from the old PyChess knocks before they were removed, Oct 12, 2026).
Sources and licences: sounds/SOURCES.md.

    # unzip Kenney's CC0 pack first:  https://kenney.nl/assets/impact-sounds  -> <dir>/kenney-impact/
    python3 scripts/piece-sounds.py <dir> [name ...]   # needs numpy and ffmpeg; names default to all
    python3 scripts/piece-sounds.py --ours [name ...]  # only the ones made here (no pack needed)
"""
import glob, math, os, subprocess, sys
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
SOUNDS = os.path.join(HERE, "../packages/app/public/sounds")
OUT = os.path.join(SOUNDS, "pieces")
ARGS = sys.argv[1:]
PACKS = None if not ARGS or ARGS[0] == "--ours" else ARGS[0]
ONLY = set(ARGS[1:])


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def pack(name):
    hits = glob.glob(os.path.join(PACKS, "**", name), recursive=True)
    if not hits:
        sys.exit(f"{name} not found under {PACKS}")
    return load(hits[0])


def biquad(x, kind, f, q=0.707):
    """An RBJ biquad (the same shapes as Web Audio's BiquadFilterNode)."""
    w = 2 * math.pi * f / SR
    a = math.sin(w) / (2 * q)
    c = math.cos(w)
    if kind == "lowpass":
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
    elif kind == "highpass":
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    else:  # bandpass, 0 dB peak
        b = [a, 0.0, -a]
    a0, a1, a2 = 1 + a, -2 * c, 1 - a
    b0, b1, b2 = (v / a0 for v in b)
    a1, a2 = a1 / a0, a2 / a0
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        out = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, out
        y[i] = out
    return y


def loudness(x):
    """The loudest 30 ms (RMS, dB) as a phone plays it in the game: high-passed at 200 Hz, low-passed at 6 kHz."""
    y = biquad(biquad(x, "highpass", 200), "lowpass", 6000)
    w = int(0.03 * SR)
    p = np.convolve(y * y, np.ones(w) / w, mode="valid") if len(y) > w else np.array([np.mean(y * y)])
    return 10 * math.log10(max(p.max(), 1e-12))


def strike(modes, length, noise=None, attack=0.0008, seed=1):
    """
    One hit: `modes` are (frequency, level, decay seconds to 1/e); `noise` is (level, decay, filter, frequency) for the
    contact; `attack` a raised-cosine fade-in so nothing clicks.
    """
    n = int(length * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f, level, decay in modes:
        y += level * np.sin(2 * math.pi * f * t) * np.exp(-t / decay)
    if noise:
        level, decay, kind, f = noise
        rng = np.random.default_rng(seed)
        burst = rng.uniform(-1, 1, n) * np.exp(-t / decay)
        y += level * biquad(burst, kind, f, 0.9)
    a = int(attack * SR)
    if a:
        y[:a] *= 0.5 - 0.5 * np.cos(np.linspace(0, math.pi, a))
    return y


def pitch(x, semis):
    """Resample: shift pitch (and length) by `semis` semitones."""
    r = 2 ** (semis / 12)
    return np.interp(np.arange(int(len(x) / r)) * r, np.arange(len(x)), x)


def place(parts, length):
    out = np.zeros(int(length * SR))
    for at, x, level in parts:
        i = int(at * SR)
        m = min(len(x), len(out) - i)
        out[i:i + m] += level * x[:m]
    return out


def trim(x, thr_db=-30):
    """From just before the hit (the first sample within `thr_db` of the peak) on."""
    peak = np.abs(x).max()
    i = int(np.argmax(np.abs(x) > peak * 10 ** (thr_db / 20)))
    return x[max(0, i - int(0.001 * SR)):]


def finish(x, length, fade=0.03):
    """Cut to `length` seconds with a cosine fade-out over the last `fade` seconds."""
    x = x[: int(length * SR)].copy()
    f = min(int(fade * SR), len(x))
    x[len(x) - f:] *= 0.5 + 0.5 * np.cos(np.linspace(0, math.pi, f))
    return x


# --- Ours -------------------------------------------------------------------------------------------------------

def wood_tap():
    """A short, bright wooden knock (as the game's first knock was: about 13 ms to fall 20 dB, centred near 1.2 kHz)."""
    return strike([(1180, 1.0, 0.0075), (2650, 0.42, 0.0042), (610, 0.55, 0.011), (4100, 0.12, 0.0025)], 0.09, noise=(0.45, 0.0005, "bandpass", 2600), seed=6)


# --- Kenney's (CC0) ---------------------------------------------------------------------------------------------

def light_wood():
    return trim(pack("impactWood_light_000.ogg"))


def ringing_wood():
    return trim(pack("impactWood_light_004.ogg"))


def deep_wood():
    return trim(pack("impactWood_light_003.ogg"))


def bright_wood():
    # A smaller piece: pitched up three semitones.
    return trim(pitch(pack("impactWood_light_002.ogg"), 3))


def heavy_wood():
    return trim(pack("impactWood_medium_002.ogg"))


def double_knock():
    # Piece on piece, then the board: a light knock, then a heavy one 45 ms later (as the old capture did).
    return place([(0, light_wood(), 0.7), (0.045, trim(pack("impactWood_medium_000.ogg")), 1.0)], 0.32)


def big_wood():
    return trim(pack("impactWood_heavy_003.ogg"))


def short_wood():
    return trim(pack("impactWood_medium_003.ogg"))


def wood_block():
    # A hollow block: pitched up two semitones.
    return trim(pitch(pack("impactWood_medium_004.ogg"), 2))


def castle_wood():
    # King, then rook: two Light wood knocks 110 ms apart, the second a little softer (as castling with any other
    # pick sounds: sound.ts plays it twice).
    k = light_wood()
    return place([(0, k, 1.0), (0.11, k, 0.8)], 0.30)


# name: (make, kind it's levelled against, length seconds, fade seconds, ours)
FILES = {
    "move-light-wood": (light_wood, "move", 0.14, 0.05, False),
    "move-wood-tap": (wood_tap, "move", 0.09, 0.04, True),
    "move-ringing-wood": (ringing_wood, "move", 0.22, 0.10, False),
    "move-deep-wood": (deep_wood, "move", 0.18, 0.08, False),
    "move-bright-wood": (bright_wood, "move", 0.14, 0.05, False),
    "capture-heavy-wood": (heavy_wood, "capture", 0.26, 0.10, False),
    "capture-double-knock": (double_knock, "capture", 0.30, 0.10, False),
    "capture-big-wood": (big_wood, "capture", 0.28, 0.12, False),
    "capture-short-wood": (short_wood, "capture", 0.20, 0.08, False),
    "capture-wood-block": (wood_block, "capture", 0.24, 0.10, False),
    "castle-wood": (castle_wood, "move", 0.30, 0.10, False),
}


def encode(x, path):
    pcm = np.clip(x, -1, 1).astype("<f4").tobytes()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "libmp3lame", "-b:a", "96k", path],
        input=pcm, check=True,
    )


# The game's knocks' loudness (dB, as `loudness` measures it): the old move and capture sounds', measured Oct 12, 2026.
TARGET = {"move": -19.95, "capture": -20.57}


def main():
    os.makedirs(OUT, exist_ok=True)
    target = TARGET
    print(f"targets: move {target['move']:.1f} dB, capture {target['capture']:.1f} dB")
    for name, (make, kind, length, fade, ours) in FILES.items():
        if ONLY and name not in ONLY:
            continue
        if not ours and PACKS is None:
            continue
        x = finish(make(), length, fade)
        x *= 10 ** ((target[kind] - loudness(x)) / 20)
        peak = 20 * math.log10(np.abs(x).max())
        if peak > -1:
            sys.exit(f"{name}: peak {peak:.1f} dBFS after levelling (would clip)")
        path = os.path.join(OUT, f"{name}.mp3")
        encode(x, path)
        got = load(path)
        print(f"{name:20s} {len(x) / SR * 1000:4.0f} ms  peak {peak:5.1f} dBFS  loudness {loudness(got):5.1f} dB  {os.path.getsize(path):5d} bytes")


main()
