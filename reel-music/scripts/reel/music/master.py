"""Masters a raw render into the loop the reel plays: wraps the tail onto the start (so reverb and echo carry across the loop
point), takes out rumble, sets the loudness to -16 LUFS with a look-ahead limiter under -1 dBTP, and writes the WAV, OGG and
MP3, plus the track muxed onto the reel (<name>-with-reel.mp4).
    python3 master.py <raw.wav> <loop seconds> <out base> [reel.mp4]
"""
import json
import subprocess
import sys

import numpy as np
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, sosfiltfilt

RATE = 48000
TARGET = -16.0
CEILING = 10 ** (-1.5 / 20)  # sample ceiling: leaves room for the true peak (-1 dBTP) and the encoders


def read(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(RATE), "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def loudness(x, true_peak=False):
    p = subprocess.run(
        ["ffmpeg", "-v", "info", "-f", "f64le", "-ar", str(RATE), "-ac", "2", "-i", "-", "-af", f"ebur128=peak={'true' if true_peak else 'sample'}", "-f", "null", "-"],
        input=x.astype(np.float64).tobytes(), capture_output=True,
    ).stderr.decode()
    s = p[p.rindex("Summary:"):]
    lufs = float(s.split("I:")[1].split("LUFS")[0])
    lra = float(s.split("LRA:")[1].split("LU")[0])
    peak = float(s.split("Peak:")[1].split("dBFS")[0])
    return lufs, lra, peak


def limit(x):
    """Look-ahead peak limiter (5 ms), treating the track as a loop so the wrap point is limited like everywhere else."""
    level = np.max(np.abs(x), axis=1)
    g = np.minimum(1.0, CEILING / np.maximum(level, 1e-9))
    g = minimum_filter1d(g, 481, mode="wrap")
    g = uniform_filter1d(g, 481, mode="wrap")
    g = minimum_filter1d(g, 3, mode="wrap")
    return x * g[:, None]


def main():
    raw, loop_s, base = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    reel = sys.argv[4] if len(sys.argv) > 4 else None
    x = read(raw)
    n = round(loop_s * RATE)
    y = x[:n].copy()
    tail = x[n:]
    y[: len(tail)] += tail[:n]
    # 28 Hz high-pass (zero phase, run over three copies so the loop point stays seamless).
    sos = butter(2, 28, "highpass", fs=RATE, output="sos")
    y = sosfiltfilt(sos, np.concatenate([y, y, y]), axis=0)[n : 2 * n]
    for _ in range(3):
        lufs, _, _ = loudness(y)
        y = limit(y * 10 ** ((TARGET - lufs) / 20))
    lufs, lra, peak = loudness(y)
    _, _, tp = loudness(y, true_peak=True)
    pcm = np.clip(np.round(y * 8388607), -8388608, 8388607).astype(np.int32)
    b = (np.ascontiguousarray(pcm.astype("<i4")).view(np.uint8).reshape(-1, 4)[:, :3]).tobytes()
    wav = f"{base}.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s24le", "-ar", str(RATE), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", wav], input=b, check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libvorbis", "-q:a", "6", f"{base}.ogg"], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k", f"{base}.mp3"], check=True)
    if reel:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", reel, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", f"{base}-with-reel.mp4"],
            check=True,
        )
    # How even the loop point is: the level just before the end and just after the start.
    w = RATE // 20
    seam = 20 * np.log10(np.sqrt(np.mean(y[-w:] ** 2)) + 1e-12), 20 * np.log10(np.sqrt(np.mean(y[:w] ** 2)) + 1e-12)
    print(json.dumps({"out": base, "seconds": round(n / RATE, 3), "lufs": lufs, "lra": lra, "sample_peak_dbfs": peak, "true_peak_dbtp": tp, "seam_rms_db": [round(v, 1) for v in seam]}))


main()
