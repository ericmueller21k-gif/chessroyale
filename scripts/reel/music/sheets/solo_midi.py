"""A town piano solo as a MIDI file, the two hands on two tracks (Eric, Nov 28: "a MIDI file for the piano solo 1 for
the town ... the two-handed"). Made from the song's own notes (song_ad.py), as its `piano_solo` plays them:

    python3 sheets/solo_midi.py <out.mid> [a|b]

Twenty bars of four at the song's 129. Track 1 is the tempo; track 2 the right hand (its line, the notes under it,
and the octave under it the second time); track 3 the left hand, which has the first four bars alone. Each hand has
its own channel and the pedal changed at every bar (the song lets each note ring on as under the pedal). A quick note
is a little softer, as in the song. Not in it, as not on the sheet: the bass's one note a bar and the strings under
the last four bars. `check_sheet.py <the .mid> [a|b]` checks it against the song.
"""
import sys

sys.path.insert(0, __file__.rsplit("/", 2)[0])
from song_ad import BPM, LEFT_A, SOLOS, notes  # noqa: E402

TICKS = 480  # to the beat
BEATS = 80
RIGHT, UNDER, OCTAVE, LEFT = 100, 88, 76, 78  # how hard each part's keys go down (the song's levels: 0.1, 0.085, 0.065, 0.066)


def hands(which: str):
    """The solo's notes by hand: (beat, beats, note, loudness)."""
    solo = SOLOS[which]
    bars = lambda text, a, b: " | ".join(text.split(" | ")[a:b])
    soft = lambda d: 0.84 if d < 0.3 else 0.92 if d < 0.5 else 1.0
    left = []
    for at, text, up in ((0, LEFT_A, 0), (16, bars(LEFT_A, 0, 2), 12), (24, bars(LEFT_A, 2, 4), 0), (32, solo["left"], 0), (48, LEFT_A, 0), (64, solo["left"], 0)):
        left += [(b, d, m + up, LEFT * soft(d)) for b, d, m in notes(at, text)]
    right = []
    for i, line in enumerate(solo["right"]):
        right += [(b, d, m, RIGHT * soft(d)) for b, d, m in notes(16 + 16 * i, line)]
    for off, line in solo["under"]:
        right += [(b, d, m, UNDER * soft(d)) for b, d, m in notes(16 + off, line)]
    for off, line, slow in solo["doubled"]:
        right += [(b, d, m - 12, OCTAVE * soft(d)) for b, d, m in notes(16 + off, line) if not (slow and d < 0.3)]
    return sorted(right), sorted(left)


def var(n: int) -> bytes:
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(out))


def track(events) -> bytes:
    """(tick, order, bytes) -> a MIDI track."""
    data, now = bytearray(), 0
    for tick, _, raw in sorted(events, key=lambda e: (e[0], e[1])):
        data += var(tick - now) + raw
        now = tick
    data += b"\x00\xff\x2f\x00"
    return b"MTrk" + len(data).to_bytes(4, "big") + bytes(data)


def named(text: str) -> bytes:
    return b"\xff\x03" + var(len(text)) + text.encode()


def hand(name: str, channel: int, played) -> bytes:
    ev = [(0, 0, named(name)), (0, 1, bytes([0xC0 | channel, 0]))]
    for bar in range(BEATS // 4):  # the pedal: up on the bar line, down again just after it
        ev += [(bar * 4 * TICKS, 2, bytes([0xB0 | channel, 64, 0])), (bar * 4 * TICKS + TICKS // 10, 2, bytes([0xB0 | channel, 64, 127]))]
    ev.append((BEATS * TICKS, 2, bytes([0xB0 | channel, 64, 0])))
    for b, d, m, loud in played:
        ev.append((round(b * TICKS), 5, bytes([0x90 | channel, m, max(1, min(127, round(loud)))])))
        ev.append((round((b + d) * TICKS), 3, bytes([0x80 | channel, m, 0])))
    return track(ev)


def main(out: str, which: str = "a") -> None:
    right, left = hands(which)
    tempo = round(60e6 / BPM)
    lead = track([(0, 0, named(f"Town piano solo {'1' if which == 'a' else '2'}")), (0, 1, b"\xff\x51\x03" + tempo.to_bytes(3, "big")), (0, 2, b"\xff\x58\x04\x04\x02\x18\x08")])
    with open(out, "wb") as f:
        f.write(b"MThd" + (6).to_bytes(4, "big") + (1).to_bytes(2, "big") + (3).to_bytes(2, "big") + TICKS.to_bytes(2, "big"))
        f.write(lead + hand("Right hand", 0, right) + hand("Left hand", 1, left))
    print(f"{out}: {len(right)} notes in the right hand, {len(left)} in the left, {BEATS // 4} bars at {BPM:g}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "a")
