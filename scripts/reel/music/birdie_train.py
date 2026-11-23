"""The train's sound for Birdie's ordinary move in the game: the crossing's locomotive (song_aj.py's chuff_wave,
knock_wave, steam_wave and whistle_wave) cut to a few short runs. Eric, Nov 23: "the train sound from the same clip
... I want ... the train sound made ... when he does his normal move throughout the game when he goes across the
board ... a couple versions of that too, like just a couple different lengths or whatever. Nothing crazy."

    python3 birdie_train.py <out folder>

Writes each run dry, mono, 44.1 kHz, as .wav and .mp3, and a sheet of them in a row. The puffs come as fast as in
the song (an 8th at 162: 0.185 s), the strong one first and then every fourth; each run swells and falls a little, as
a train coming and going by. One gain for the whole set (the loudest peaks at -6 dBFS).
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


def main(out: str) -> None:
    os.makedirs(out, exist_ok=True)
    rng = np.random.default_rng(162)
    made = {kind: run(kind, rng) for kind in RUNS}
    gain = 10 ** (-6 / 20) / max(np.abs(x).max() for x in made.values())
    sheet = [np.zeros(int(0.3 * SR))]
    for kind, x in made.items():
        x = x * gain
        save(f"{out}/birdie-train-{kind}.wav", x)
        subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", f"{out}/birdie-train-{kind}.wav", "-c:a", "libmp3lame", "-b:a", "112k", f"{out}/birdie-train-{kind}.mp3"], check=True)
        sheet += [x, np.zeros(int(0.8 * SR))]
        sp = np.abs(np.fft.rfft(x)) ** 2
        f = np.fft.rfftfreq(len(x), 1 / SR)
        print(f"{kind:7} {len(x) / SR:.2f} s, {len(RUNS[kind][0])} puffs, peak {20 * np.log10(np.abs(x).max()):.1f} dBFS, rms {20 * np.log10(np.sqrt(np.mean(x**2))):.1f}, "
              f"under 6 kHz {100 * sp[f < 6000].sum() / sp.sum():.1f}% of it, under 150 Hz {100 * sp[f < 150].sum() / sp.sum():.1f}%")
    save(f"{out}/birdie-train-sheet.wav", np.concatenate(sheet))
    subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", f"{out}/birdie-train-sheet.wav", "-c:a", "libmp3lame", "-b:a", "128k", f"{out}/birdie-train-sheet.mp3"], check=True)


if __name__ == "__main__":
    main(sys.argv[1])
