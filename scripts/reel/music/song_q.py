"""Song Q (Eric, Nov 11): Timber the beaver's theme, a two-minute loop: Song P's woodshop (the same kit, bass and tools,
bar for bar) with the beaver's own tunes over it, on a high chattering xylophone with the marimba answering.
See song_p.py for the form and the sounds.
  python3 song_q.py <out.wav>
"""
import sys

from song_p import BEATS, BPM, SECS, compose  # noqa: F401 (the handoff reads BPM)
from synth import write_wav


def main(out: str) -> None:
    write_wav(out, compose("beaver"))


if __name__ == "__main__":
    main(sys.argv[1])
