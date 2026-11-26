"""Checks a solo's sheet (sheets/town-solo-<a|b>.ly) against the song's own notes (song_ad.py): every note the piano
plays in the solo must be in the MIDI the sheet writes, at its beat and pitch, and nothing else.

    python3 sheets/check_sheet.py <the .midi lilypond wrote> [a|b]

The sheet has what the piano plays: the left hand, the right hand, the notes under it and the octave under it. A
flick (a note shorter than a quarter of a beat) may sit a little before the beat on the page.
"""
import sys

sys.path.insert(0, __file__.rsplit("/", 2)[0])
from song_ad import LEFT_A, SOLOS, notes  # noqa: E402


def expected(which: str) -> list:
    solo = SOLOS[which]
    bars = lambda text, a, b: " | ".join(text.split(" | ")[a:b])
    out = []
    for at, text, up in ((0, LEFT_A, 0), (16, bars(LEFT_A, 0, 2), 12), (24, bars(LEFT_A, 2, 4), 0), (32, solo["left"], 0), (48, LEFT_A, 0), (64, solo["left"], 0)):
        out += [(b, m + up) for b, d, m in notes(at, text)]
    for i, line in enumerate(solo["right"]):
        out += [(b, m) for b, d, m in notes(16 + 16 * i, line)]
    for off, line in solo["under"]:
        out += [(b, m) for b, d, m in notes(16 + off, line)]
    for off, line, slow in solo["doubled"]:
        out += [(b, m - 12) for b, d, m in notes(16 + off, line) if not (slow and d < 0.3)]
    return sorted(out)


def played(path: str) -> list:
    """(beat, pitch) of every note-on in a MIDI file."""
    data = open(path, "rb").read()
    division = int.from_bytes(data[12:14], "big")
    out, i = [], 14
    while i < len(data):
        assert data[i : i + 4] == b"MTrk"
        end = i + 8 + int.from_bytes(data[i + 4 : i + 8], "big")
        i, tick, status = i + 8, 0, 0
        while i < end:
            delta = 0
            while True:
                delta = (delta << 7) | (data[i] & 0x7F)
                i += 1
                if not data[i - 1] & 0x80:
                    break
            tick += delta
            if data[i] & 0x80:
                status = data[i]
                i += 1
            if status == 0xFF:
                size = data[i + 1]
                i += 2 + size
            elif status in (0xF0, 0xF7):
                i += 1 + data[i]
            elif status & 0xF0 in (0xC0, 0xD0):
                i += 1
            else:
                if status & 0xF0 == 0x90 and data[i + 1] > 0:
                    out.append((tick / division, data[i]))
                i += 2
    return sorted(out)


def main(path: str, which: str = "a") -> None:
    want, got = expected(which), played(path)
    left = list(got)
    missing = []
    for b, m in want:
        near = [g for g in left if g[1] == m and abs(g[0] - b) <= 0.26]
        if near:
            left.remove(min(near, key=lambda g: abs(g[0] - b)))
        else:
            missing.append((b, m))
    name = lambda m: "C C# D D# E F F# G G# A A# B".split()[m % 12] + str(m // 12 - 1)
    where = lambda b: f"bar {int(b // 4) + 1} beat {b % 4 + 1:g}"
    print(f"{len(want)} notes in the song, {len(got)} on the sheet")
    for b, m in missing:
        print("  not on the sheet:", name(m), where(b))
    for b, m in left:
        print("  on the sheet only:", name(m), where(b))
    print("the sheet matches the song" if not missing and not left else "the sheet does NOT match")


if __name__ == "__main__":
    main(*sys.argv[1:])
