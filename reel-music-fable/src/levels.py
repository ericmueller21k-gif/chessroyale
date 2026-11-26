"""Prints each bar's level (dB RMS) and peak, to check the shape of a track against the reel."""
import sys, wave
import numpy as np
for p in sys.argv[1:]:
    w = wave.open(p); x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2).astype(float) / 32768
    n = len(x); off = int(0.25 * w.getframerate()); bar = (n / 16)
    row = []
    for b in range(16):
        seg = x[int(off + b * bar): int(off + (b + 1) * bar)]
        row.append("%d:%.0f" % (b, 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)))
    print(p.split("/")[-1], "peak %.2f" % np.max(np.abs(x)), "seam jump %.4f" % np.max(np.abs(x[0] - x[-1])), " ".join(row))
