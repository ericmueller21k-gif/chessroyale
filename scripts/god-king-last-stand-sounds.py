"""
The God King's Last Stand sounds, cut from two CC0 packs (see packages/app/public/sounds/god-king/CREDITS.md):
the leap, the crash, the 25 slashes, two grunts of agony and the death groan.

    # unzip both packs into one folder first:
    #   https://opengameart.org/content/512-sound-effects-8-bit-style  -> <dir>/retro/
    #   https://opengameart.org/content/male-gruntyelling-sounds       -> <dir>/yell/
    python3 scripts/god-king-last-stand-sounds.py <dir>   # needs numpy and ffmpeg
"""
import subprocess, numpy as np, os, random, sys
SR = 44100
PACKS = sys.argv[1]
R = os.path.join(PACKS, "retro/The Essential Retro Video Game Sound Effects Collection [512 sounds] By Juhani Junkala")
Y = os.path.join(PACKS, "yell/yelling sounds")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../packages/app/public/sounds/god-king")

def load(f, af=None):
    cmd = ["ffmpeg", "-loglevel", "error", "-i", f]
    if af: cmd += ["-af", af]
    cmd += ["-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).copy()

def trim(x, thr=0.01):
    idx = np.where(np.abs(x) > thr)[0]
    return x[idx[0]: idx[-1] + 1] if len(idx) else x

def pitch(x, semis):
    """Resample: shift pitch (and length) by `semis` semitones."""
    r = 2 ** (semis / 12)
    n = int(len(x) / r)
    return np.interp(np.arange(n) * r, np.arange(len(x)), x).astype(np.float32)

def mix(parts, length=None):
    end = max(int(at * SR) + len(x) for at, x, _ in parts)
    out = np.zeros(length or end, dtype=np.float32)
    for at, x, gain in parts:
        i = int(at * SR)
        seg = x[: max(0, len(out) - i)]
        out[i: i + len(seg)] += seg * gain
    return out

def save(x, name, af=None, peak_db=-3.0):
    x = x / max(1e-6, np.abs(x).max()) * (10 ** (peak_db / 20))
    fade = int(0.01 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)
    cmd = ["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-"]
    if af: cmd += ["-af", af]
    cmd += ["-ar", "44100", "-ac", "1", "-b:a", "96k", os.path.join(OUT, name)]
    subprocess.run(cmd, input=x.astype(np.float32).tobytes(), check=True)
    print("wrote", name, f"{len(x) / SR:.2f}s")

# The leap: a heavy jump up out of the dock, then a falling whistle into the crash (which comes 0.75 s later).
jump = trim(load(f"{R}/Movement/Jumping and Landing/sfx_movement_jump19.wav"))
fall = trim(load(f"{R}/Movement/Falling Sounds/sfx_sounds_falling3.wav", "atempo=2.0"))[: int(0.42 * SR)]
fall[-int(0.05 * SR):] *= np.linspace(1, 0.3, int(0.05 * SR))
save(mix([(0, jump, 1.0), (0.33, fall, 0.55)]), "last-leap.mp3")

# The crash: a hard, low explosion with an impact on top, pitched down for weight.
boom = pitch(trim(load(f"{R}/Explosions/Short/sfx_exp_short_hard2.wav")), -3)
thud = pitch(trim(load(f"{R}/General Sounds/Impacts/sfx_sounds_impact12.wav")), -2)
save(mix([(0, boom, 1.0), (0, thud, 0.9)]), "last-crash.mp3", "afade=t=out:st=0.5:d=0.25")

# The blow: 25 slashes, one every 80 ms (2 s), sword swishes of varying pitch, each landing with a hit.
random.seed(25)
swords = [trim(load(f"{R}/Weapons/Melee/sfx_wpn_sword{i}.wav")) for i in (1, 2)]
hits = [trim(load(f"{R}/General Sounds/Simple Damage Sounds/sfx_damage_hit{i}.wav")) for i in (3, 5, 8, 10)]
parts = []
for k in range(25):
    at = k * 0.08
    parts.append((at, pitch(swords[k % 2], random.uniform(-2.5, 2.0)), 0.75))
    parts.append((at + 0.025, pitch(hits[k % 4], random.uniform(-3, 0)), 0.55 if k % 3 else 0.8))
save(mix(parts), "last-slashes.mp3", "afade=t=out:st=1.95:d=0.25", -4.0)

# Grunts of agony: two short pained grunts, a little deeper, with a light 16-bit crunch (like his "hyuah!").
crunch = "acrusher=bits=10:mode=log:aa=1:samples=2:mix=0.35"
save(pitch(trim(load(f"{Y}/3grunt4.wav")), -2), "last-grunt1.mp3", crunch, -5.0)
save(pitch(trim(load(f"{Y}/1yell7.wav")), -3), "last-grunt2.mp3", crunch, -5.0)

# The death groan: a falling groan, deeper and slower, trailing off into an echo.
groan = pitch(trim(load(f"{Y}/yell3.wav")), -4)
groan = np.concatenate([groan, np.zeros(int(0.6 * SR), dtype=np.float32)])
save(groan, "last-groan.mp3", f"{crunch},aecho=0.8:0.6:120|260:0.35|0.2,afade=t=out:st={len(groan) / SR - 0.7:.2f}:d=0.7,volume=7dB", -4.0)
