"""The train's sound for Birdie's ordinary move in the game: the crossing's locomotive (song_aj.py's chuff_wave,
knock_wave, steam_wave and whistle_wave) cut to a few short runs. Eric, Nov 23: "the train sound from the same clip
... I want ... the train sound made ... when he does his normal move throughout the game when he goes across the
board ... a couple versions of that too, like just a couple different lengths or whatever. Nothing crazy."

Then, of those runs: "I was thinking more whistles than the other stuff. Or we want a couple different whistles. And
like the double whistle, you know how the trains go like toot toot?" So the whistles are the move's sound, five of
them (the song's own whistle: its three pipes, B, E and G), and the runs are there to go under one if wanted.

    python3 birdie_train.py <out folder>

Writes each whistle and each run dry, mono, 44.1 kHz, as .wav and .mp3, and a sheet of each kind in a row. The runs'
puffs come as fast as in the song (an 8th at 162: 0.185 s), the strong one first and then every fourth; each run
swells and falls a little, as a train coming and going by. One gain for each set (its loudest peaks at -6 dBFS).
"""
import os
import subprocess
import sys
import wave

import numpy as np

from song_aj import BPM, chuff_wave, knock_wave, steam_wave, whistle_wave

SR = 44100
STEP = 30 / BPM  # an 8th of the song: 0.185 s
# How loud each sound is against a strong puff (the crossing's own levels): a weak puff, a knock, steam, the whistle.
WEAK, KNOCK, STEAM, WHISTLE = 0.6, 0.41, 0.32, 0.4
PIPES = (493.88, 659.26, 783.99)  # the whistle's chord in the song: B4, E5, G5
# A run: how loud each of its puffs is (one every STEP), where its rail joints fall (s), a puff of steam at its end,
# a toot of the whistle over its start (s long).
RUNS = {
    "short": ((0.9, 1.0, 0.75), (0.46,), False, 0.0),
    "medium": ((0.8, 1.0, 1.0, 0.9, 0.7), (0.28, 0.65), False, 0.0),
    "long": ((0.6, 0.8, 1.0, 1.0, 1.0, 0.9, 0.75, 0.6), (0.28, 0.83, 1.2), True, 0.0),
    "toot": ((0.8, 1.0, 1.0, 0.9, 0.7), (0.28, 0.65), False, 0.32),
}


# A whistle: its blasts, each (seconds in, how long, how loud), and its pipes (Hz). "peep-peep" is a smaller whistle:
# the same chord a step up the pipes (E, G, B).
HIGH = (659.26, 783.99, 987.77)
WHISTLES = {
    "toot": (((0.0, 0.28, 1.0),), PIPES),
    "toot-toot": (((0.0, 0.24, 0.9), (0.34, 0.24, 1.0)), PIPES),
    "long": (((0.0, 0.9, 1.0),), PIPES),
    "toot-long": (((0.0, 0.2, 0.9), (0.3, 0.75, 1.0)), PIPES),
    "peep-peep": (((0.0, 0.16, 0.9), (0.24, 0.16, 1.0)), HIGH),
}


def whistle(kind: str) -> np.ndarray:
    blasts, pipes = WHISTLES[kind]
    out = np.zeros(int(SR * 3))
    for at, secs, loud in blasts:
        w = whistle_wave(SR, int(secs * SR), pipes) * loud
        i = int(round(at * SR))
        out[i : i + len(w)] += w
    return out[: int(round((blasts[-1][0] + blasts[-1][1]) * SR))]


def run(kind: str, rng) -> np.ndarray:
    puffs, joints, steam, toot = RUNS[kind]
    out = np.zeros(int(SR * 3))
    end = 0

    def lay(at, w):
        nonlocal end
        i = int(round(at * SR))
        out[i : i + len(w)] += w
        end = max(end, i + len(w))

    for i, loud in enumerate(puffs):
        strong = i % 4 == 0
        lay(i * STEP, chuff_wave(rng, SR, strong) * loud * (1.0 if strong else WEAK))
    for at in joints:
        for late in (0.0, 0.085):
            lay(at + late, knock_wave(rng, SR) * KNOCK)
    if steam:
        lay(len(puffs) * STEP - 0.05, steam_wave(rng, SR, 0.35) * STEAM)
    if toot:
        lay(0.0, whistle_wave(SR, int(toot * SR), PIPES) * WHISTLE)
    return out[:end]


def save(path: str, x: np.ndarray) -> None:
    with wave.open(path, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def write(out: str, stem: str, made: dict) -> None:
    """A set of sounds under one gain (the loudest peaks at -6 dBFS), each as .wav and .mp3, and a sheet of them."""
    gain = 10 ** (-6 / 20) / max(np.abs(x).max() for x in made.values())
    sheet = [np.zeros(int(0.3 * SR))]
    for kind, x in made.items():
        x = x * gain
        save(f"{out}/{stem}-{kind}.wav", x)
        subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", f"{out}/{stem}-{kind}.wav", "-c:a", "libmp3lame", "-b:a", "112k", f"{out}/{stem}-{kind}.mp3"], check=True)
        sheet += [x, np.zeros(int(0.8 * SR))]
        sp = np.abs(np.fft.rfft(x)) ** 2
        f = np.fft.rfftfreq(len(x), 1 / SR)
        print(f"{stem}-{kind:10} {len(x) / SR:.2f} s, peak {20 * np.log10(np.abs(x).max()):.1f} dBFS, rms {20 * np.log10(np.sqrt(np.mean(x**2))):.1f}, "
              f"under 6 kHz {100 * sp[f < 6000].sum() / sp.sum():.1f}% of it, strongest at {f[np.argmax(sp)]:.0f} Hz")
    save(f"{out}/{stem}-sheet.wav", np.concatenate(sheet))
    subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", f"{out}/{stem}-sheet.wav", "-c:a", "libmp3lame", "-b:a", "128k", f"{out}/{stem}-sheet.mp3"], check=True)


def main(out: str) -> None:
    os.makedirs(out, exist_ok=True)
    rng = np.random.default_rng(162)
    write(out, "birdie-train", {kind: run(kind, rng) for kind in RUNS})
    write(out, "birdie-whistle", {kind: whistle(kind) for kind in WHISTLES})


if __name__ == "__main__":
    main(sys.argv[1])
