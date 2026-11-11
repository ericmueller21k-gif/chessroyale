"""Prints a track's level bar by bar (dB RMS; a bar is 1.6 s, or `path:secs`), its peak and the jump across the loop point."""
import sys, wave
import numpy as np
for p in sys.argv[1:]:
    p, _, secs = p.partition(":")
    w = wave.open(p); x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2).astype(float) / 32768
    bar = int(float(secs or 1.6) * w.getframerate())
    row = ["%d:%.0f" % (b, 20 * np.log10(np.sqrt(np.mean(x[b * bar:(b + 1) * bar] ** 2)) + 1e-9)) for b in range(len(x) // bar)]
    print(p.split("/")[-1], "%.2f s" % (len(x) / w.getframerate()), "peak %.2f" % np.max(np.abs(x)), "seam jump %.4f" % np.max(np.abs(x[0] - x[-1])), " ".join(row))
