"""Takes the "air" out of a short voice clip: the hiss above and between the voice's own harmonics, and the breathy
tail. Written for the God King's shouts (Eric, Nov 20: "it makes it sound airy or something").

    python3 voice_clean.py in.wav out.wav [strength, default 1.0]

What it does, in order:
  - between the harmonics, above 700 Hz: each moment's spectrum (averaged over 25 ms) is compared with its own
    smoothed floor, and what doesn't stand clear of the floor is turned down, by up to 12 dB at strength 1;
  - above the voice: a steep low-pass at 5 kHz (what the shouts held above it measured as noise, not voice);
  - below it: a high-pass at 70 Hz;
  - the tail: once the voice has fallen 22 dB from its loudest, what's left fades out in 60 ms.
Mono out, at the input's sample rate. The level isn't touched: set it afterwards."""
import sys
import wave

import numpy as np

FRAME, HOP = 1024, 128


def clean(x, sr, strength=1.0):
    win = np.hanning(FRAME + 1)[:FRAME]
    pad = np.concatenate([np.zeros(FRAME), x, np.zeros(FRAME)])
    starts = range(0, len(pad) - FRAME, HOP)
    spec = np.array([np.fft.rfft(pad[i:i + FRAME] * win) for i in starts])
    f = np.fft.rfftfreq(FRAME, 1 / sr)

    # Judged on a 25 ms average, so a steady harmonic passes and a chance peak in the hiss doesn't (no chirping).
    tw = np.hanning(11)
    mag = np.apply_along_axis(lambda c: np.convolve(c, tw / tw.sum(), mode="same"), 0, np.abs(spec))
    # The floor: a running median over about 330 Hz, which the harmonics stand above.
    near = np.clip(np.arange(len(f))[:, None] + np.arange(-3, 4)[None, :], 0, len(f) - 1)
    floor = np.median(mag[:, near], axis=2)
    gain = mag ** 2 / (mag ** 2 + (1.6 * floor) ** 2 + 1e-18)
    gain = np.maximum(gain / gain.max(axis=1, keepdims=True).clip(1e-9), 10 ** (-12 * strength / 20))
    gain = np.where(f[None, :] < 700, 1.0, gain)
    gain[1:-1] = (gain[:-2] + gain[1:-1] + gain[2:]) / 3

    top = 5000 - 1000 * (strength - 1)
    shape = 1 / np.sqrt(1 + (f / top) ** 16) * (f / 70) / np.sqrt(1 + (f / 70) ** 2)
    y, norm = np.zeros(len(pad)), np.zeros(len(pad))
    for row, i in zip(spec * gain * shape[None, :], starts):
        y[i:i + FRAME] += np.fft.irfft(row, FRAME) * win
        norm[i:i + FRAME] += win ** 2
    y = (y / np.maximum(norm, 1e-6))[FRAME:FRAME + len(x)]

    # The tail: levels every 5 ms; the fade starts where the voice is first 22 dB under its loudest.
    step = int(0.005 * sr)
    level = 20 * np.log10(np.array([np.sqrt((y[i:i + step] ** 2).mean()) for i in range(0, len(y) - step, step)]) + 1e-9)
    loudest = int(np.argmax(level))
    under = np.nonzero(level[loudest:] < level.max() - 22)[0]
    if len(under):
        cut = (loudest + under[0]) * step
        fade = min(int(0.06 * sr), len(y) - cut)
        y[cut:cut + fade] *= np.linspace(1, 0, fade) ** 2
        y[cut + fade:] = 0
    return y


def main(src, out, strength="1.0"):
    with wave.open(src) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, w.getnchannels()).mean(axis=1) / 32768
    y = clean(x, sr, float(strength))
    with wave.open(out, "wb") as o:
        o.setnchannels(1), o.setsampwidth(2), o.setframerate(sr)
        o.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    main(*sys.argv[1:])
