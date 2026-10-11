"""
The piece-sound picks in Settings (Move sound, Capture sound): makes every file in packages/app/public/sounds/pieces/.
Today's wooden knocks (sounds/move.mp3, sounds/capture.mp3) stay the defaults and aren't touched.

- Ours (synthesised here, no licence needed): move "Click" and "Soft", capture "Clack" and "Thud". Struck wood is a
  few decaying partials plus a very short burst of filtered noise for the contact.
- Kenney's (CC0): move "Light wood" and "Poker chip", capture "Heavy wood" and "Chips", cut from two packs.

Every file is trimmed to start on its hit (so it lands with the piece), faded out, and levelled to the default it
sits beside: the loudest 30 ms, heard through a phone speaker (high-passed at 200 Hz) and the game's own 6 kHz
low-pass, matches today's move (for moves) or capture (for captures). Sources and licences: sounds/SOURCES.md.

    # unzip both CC0 packs into one folder first:
    #   https://kenney.nl/assets/impact-sounds  -> <dir>/kenney-impact/
    #   https://kenney.nl/assets/casino-audio   -> <dir>/kenney-casino/
    python3 scripts/piece-sounds.py <dir> [name ...]   # needs numpy and ffmpeg; names default to all
    python3 scripts/piece-sounds.py --ours [name ...]  # only the synthesised ones (no packs needed)
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

def click():
    """A crisp, bright knock: a hard wooden piece set down smartly."""
    return strike([(1320, 1.0, 0.016), (2950, 0.45, 0.007), (4420, 0.18, 0.004), (560, 0.35, 0.022)], 0.12, noise=(0.5, 0.0005, "bandpass", 3200))


def soft():
    """A felt-bottomed piece: low, round and short, with only a whisper of contact."""
    return strike([(310, 1.0, 0.034), (720, 0.5, 0.014), (1560, 0.15, 0.006)], 0.16, noise=(0.25, 0.002, "lowpass", 1400), attack=0.0015, seed=2)


def clack():
    """Piece knocks piece (bright, hard), then sets down with the Click."""
    hit = strike([(2050, 1.0, 0.009), (3180, 0.6, 0.006), (4700, 0.3, 0.003), (980, 0.35, 0.012)], 0.06, noise=(0.8, 0.0004, "bandpass", 3800), seed=3)
    return place([(0, hit, 1.0), (0.06, click(), 0.8)], 0.2)


def thud():
    """A small knock, then a heavy, low wooden landing."""
    knock = strike([(900, 1.0, 0.008), (2100, 0.4, 0.004)], 0.05, noise=(0.3, 0.0005, "bandpass", 2500), seed=4)
    land = strike([(190, 1.0, 0.06), (470, 0.7, 0.03), (1080, 0.3, 0.012), (2400, 0.08, 0.005)], 0.22, noise=(0.35, 0.003, "lowpass", 1800), attack=0.001, seed=5)
    return place([(0, knock, 0.5), (0.035, land, 1.0)], 0.25)


# --- Kenney's (CC0) ---------------------------------------------------------------------------------------------

def light_wood():
    return trim(pack("impactWood_light_000.ogg"))


def heavy_wood():
    return trim(pack("impactWood_medium_002.ogg"))


def poker_chip():
    # The file starts with 85 ms of a hand sliding the chip: the hit is where it lands.
    return trim(pack("chip-lay-3.ogg"), -12)


def chips():
    # Pitched down a fifth (bigger, heavier chips): as recorded, most of it is above the game's 6 kHz low-pass.
    return trim(pitch(pack("chips-collide-2.ogg"), -7))


# name: (make, kind it's levelled against, length seconds, fade seconds, ours)
FILES = {
    "move-click": (click, "move", 0.10, 0.04, True),
    "move-soft": (soft, "move", 0.14, 0.05, True),
    "move-light-wood": (light_wood, "move", 0.14, 0.05, False),
    "move-poker-chip": (poker_chip, "move", 0.16, 0.06, False),
    "capture-clack": (clack, "capture", 0.18, 0.05, True),
    "capture-thud": (thud, "capture", 0.24, 0.08, True),
    "capture-heavy-wood": (heavy_wood, "capture", 0.26, 0.10, False),
    "capture-chips": (chips, "capture", 0.20, 0.08, False),
}


def encode(x, path):
    pcm = np.clip(x, -1, 1).astype("<f4").tobytes()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "libmp3lame", "-b:a", "96k", path],
        input=pcm, check=True,
    )


def main():
    os.makedirs(OUT, exist_ok=True)
    target = {k: loudness(load(os.path.join(SOUNDS, f"{k}.mp3"))) for k in ("move", "capture")}
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
