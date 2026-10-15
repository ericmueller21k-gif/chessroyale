"""
The PyChess sounds' source, served with the game: writes packages/app/public/sounds/pychess-sounds-source.tar.gz.

The classic piece sounds (sounds/move.mp3, capture.mp3, castle.mp3) and their variations (sounds/pieces/*-classic-*)
are PyChess's, under the GPL-3.0, which asks for their complete corresponding source: the original WAVs and the
script that made the variations (scripts/piece-sounds.py). The site serves both in one archive, as it serves the
engines' source, so it stays available when the repository goes private (DECISIONS.md, "The PyChess sounds' source on
the site"). The archive mirrors the repository's layout, so its own README's command makes the variations again.

    # PyChess's mov2.wav, capture2.wav and castle.wav, from commit 94771355c49a04c3e8fc16dd135fe8ceed78a277 of
    # https://github.com/pychess/pychess/tree/master/sounds, in one folder:
    python3 scripts/sounds-source.py <folder>

Run it again whenever scripts/piece-sounds.py changes (packages/app/test/sounds-source.test.ts checks the archive
holds the script as it is now). The archive is the same bytes on any machine: fixed times, owners and order.
"""
import gzip, hashlib, io, os, sys, tarfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SOUNDS = os.path.join(ROOT, "packages/app/public/sounds")
OUT = os.path.join(SOUNDS, "pychess-sounds-source.tar.gz")
TOP = "pychess-sounds-source"
COMMIT = "94771355c49a04c3e8fc16dd135fe8ceed78a277"
WAVS = {
    "mov2.wav": "384da365ee83f8634ade0dbde2cca630d1445a0c88c66f25482336ad215664b6",
    "capture2.wav": "940fa6da94c79988333a8b50ce64feada662846b02b9a0e82109013bbdd29dc0",
    "castle.wav": "af72c88f87141a4a82e876bfb9c3a60628b8f528c7f85bd3638bf948e0964bcc",
}
# Oct 12, 2026, when the variations were made: every entry's time, so the archive never varies.
MTIME = 1791763200
VARIATIONS = ["move-classic-light", "move-classic-deep", "move-classic-soft", "capture-classic-light", "capture-classic-deep", "capture-classic-soft"]

README = f"""The PyChess piece sounds in HunChess, and their source (GNU GPL version 3)

HunChess (https://hunchess.com) plays these sounds from PyChess (https://github.com/pychess/pychess), by the PyChess
authors, under the GNU General Public License, version 3. They're separate files the game plays, not part of its code:

- /sounds/move.mp3, /sounds/capture.mp3 and /sounds/castle.mp3: PyChess's mov2.wav, capture2.wav and castle.wav,
  converted to mp3.
- /sounds/pieces/move-classic-light.mp3, -deep.mp3, -soft.mp3 and capture-classic-light.mp3, -deep.mp3, -soft.mp3:
  variations made from mov2.wav and capture2.wav by scripts/piece-sounds.py (modified by HunChess on October 12,
  2026: a small pitch shift, a gentle EQ, a slightly shorter or longer decay, and leveled to the classic's loudness;
  the parameters are VARIATIONS in the script).

This archive is their complete corresponding source:

- pychess/: the original WAV files, unchanged, from PyChess commit {COMMIT} (its sounds/ folder).
{chr(10).join(f"    {name}  sha256 {digest}" for name, digest in WAVS.items())}
- scripts/piece-sounds.py: the script that made the variations, under the GPL-3.0 like the sounds it makes.
- packages/app/public/sounds/move.mp3, capture.mp3, castle.mp3: the classic sounds as the game serves them (the
  script levels each variation to the loudness of move.mp3 or capture.mp3).
- COPYING.txt: the GNU General Public License, version 3.

To make the variations again (Python 3 with numpy, and ffmpeg), from this folder:

    python3 scripts/piece-sounds.py pychess {" ".join(VARIATIONS)}

They're written to packages/app/public/sounds/pieces/.
"""


def entry(tar, path, data):
    info = tarfile.TarInfo(f"{TOP}/{path}")
    info.size = len(data)
    info.mtime = MTIME
    info.mode = 0o644
    info.uid = info.gid = 0
    info.uname = info.gname = "root"
    tar.addfile(info, io.BytesIO(data))


def read(path):
    with open(path, "rb") as f:
        return f.read()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    wavs = sys.argv[1]
    files = [("README.txt", README.encode()), ("COPYING.txt", read(os.path.join(ROOT, "packages/app/public/engine/COPYING.txt")))]
    for name, digest in WAVS.items():
        data = read(os.path.join(wavs, name))
        if hashlib.sha256(data).hexdigest() != digest:
            sys.exit(f"{name} isn't PyChess's file at commit {COMMIT}")
        files.append((f"pychess/{name}", data))
    files.append(("scripts/piece-sounds.py", read(os.path.join(HERE, "piece-sounds.py"))))
    for name in ("move.mp3", "capture.mp3", "castle.mp3"):
        files.append((f"packages/app/public/sounds/{name}", read(os.path.join(SOUNDS, name))))
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.USTAR_FORMAT) as tar:
        for path, data in files:
            entry(tar, path, data)
    with open(OUT, "wb") as f, gzip.GzipFile(filename="", mode="wb", fileobj=f, compresslevel=9, mtime=0) as gz:
        gz.write(raw.getvalue())
    data = read(OUT)
    print(f"{os.path.relpath(OUT, ROOT)}: {len(data):,} bytes, sha256 {hashlib.sha256(data).hexdigest()}")


if __name__ == "__main__":
    main()
