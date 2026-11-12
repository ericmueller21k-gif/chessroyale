"""Masters a rendered loop: one fixed gain to about -16 LUFS and a soft ceiling at -1 dBFS. Both act on each sample
alone (no look-ahead, no memory), so the loop point stays seamless.
  python3 master.py <raw.wav> <out.wav>
`main` returns the gain it settled on (dB) and `ceiling` is the soft ceiling: a piece cut from a song (phases_v.py)
takes the whole song's gain, so the pieces sit together as they do in the song.
"""
import re
import subprocess
import sys
import wave

import numpy as np

TARGET, KNEE, CEIL = -16.0, 0.7, 0.89


def lufs(path: str) -> float:
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"^\s+I:\s+(-?[\d.]+) LUFS", err, re.M)[-1])


def ceiling(y: np.ndarray) -> np.ndarray:
    a = np.abs(y)
    return np.where(a < KNEE, y, np.sign(y) * (KNEE + (CEIL - KNEE) * np.tanh((a - KNEE) / (CEIL - KNEE))))


def main(raw: str, out: str) -> float:
    with wave.open(raw) as w:
        rate = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
    gain = 0.0
    for _ in range(3):  # the ceiling shaves a little level off, so settle the gain in a few passes
        used = gain
        a = np.abs(x * 10 ** (gain / 20))
        y = ceiling(x * 10 ** (gain / 20))
        with wave.open(out, "wb") as w:
            w.setnchannels(2), w.setsampwidth(2), w.setframerate(rate)
            w.writeframes((y * 32767).astype("<i2").tobytes())
        now = lufs(out)
        gain += TARGET - now
    print(f"{out}: {now:.1f} LUFS, peak {20 * np.log10(np.max(np.abs(y))):.1f} dBFS, {np.mean(a >= KNEE) * 100:.2f}% of samples above the knee")
    return used


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
