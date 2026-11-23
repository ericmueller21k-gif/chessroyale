"""Birdie's voice for the game: the crossing's bird phrases (song_aj.py's BIRDS) as sound files of their own.
Eric, Nov 23: "those bird sounds that you did from the clip ... wire those in for Birdie as like what he says ... he
chirps throughout the game ... and also when like you go to challenge him to fight ... we'll use whatever chirping you
already had created for that song ... 5 to 6 kind of variations of different chirps."

    python3 birdie_chirps.py <out folder>

Writes each phrase dry (no hall: the game's sounds have none), mono, 44.1 kHz, as .wav and .mp3; "hello" is the
crossing's first two phrases as they come there (the tsip, and the teeoo 0.52 s after it), for the challenge; and a
sheet of them all in a row. One gain for the whole set (the loudest peaks at -6 dBFS), so they keep the levels they
have against each other.
"""
import os
import subprocess
import sys
import wave

import numpy as np

from song_aj import BIRDS, BPM, tweet_wave

SR = 44100
HELLO = (("tsip", 0.0, 1.0), ("teeoo", 1.4 * 60 / BPM, 0.9))  # (the phrase, seconds in, how loud): bar 1 of the crossing
ORDER = ("hello", "tsip", "teeoo", "trill", "cheer", "ask", "scold")


def phrase(kind: str) -> np.ndarray:
    parts = HELLO if kind == "hello" else ((kind, 0.0, 1.0),)
    out = np.zeros(int(SR * 2))
    end = 0
    for name, at, loud in parts:
        for late, f0, f1, secs, vol, shake in BIRDS[name]:
            w = tweet_wave(f0, f1, secs, shake, SR) * vol * loud
            i = int(round((at + late) * SR))
            out[i : i + len(w)] += w
            end = max(end, i + len(w))
    return out[:end]


def save(path: str, x: np.ndarray) -> None:
    with wave.open(path, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def main(out: str) -> None:
    os.makedirs(out, exist_ok=True)
    made = {kind: phrase(kind) for kind in ORDER}
    gain = 10 ** (-6 / 20) / max(np.abs(x).max() for x in made.values())
    sheet = [np.zeros(int(0.3 * SR))]
    for kind in ORDER:
        x = made[kind] * gain
        save(f"{out}/birdie-chirp-{kind}.wav", x)
        subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", f"{out}/birdie-chirp-{kind}.wav", "-c:a", "libmp3lame", "-b:a", "112k", f"{out}/birdie-chirp-{kind}.mp3"], check=True)
        sheet += [x, np.zeros(int(0.7 * SR))]
        centre = np.fft.rfftfreq(len(x), 1 / SR)[np.argmax(np.abs(np.fft.rfft(x)))]
        print(f"{kind:6} {len(x) / SR:.2f} s, {len(BIRDS[kind]) if kind in BIRDS else sum(len(BIRDS[n]) for n, _, _ in HELLO)} notes, peak {20 * np.log10(np.abs(x).max()):.1f} dBFS, "
              f"rms {20 * np.log10(np.sqrt(np.mean(x**2))):.1f}, strongest at {centre:.0f} Hz")
    save(f"{out}/birdie-chirps-sheet.wav", np.concatenate(sheet))
    subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", f"{out}/birdie-chirps-sheet.wav", "-c:a", "libmp3lame", "-b:a", "128k", f"{out}/birdie-chirps-sheet.mp3"], check=True)


if __name__ == "__main__":
    main(sys.argv[1])
