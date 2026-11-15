"""Builds the town's music for the game (song_ad.py): the theme as one loop, and its two piano solos as pieces to play
between two passes of it (Eric, Nov 15: "the main theme stays the original we composed without the piano solo, but we
add these 2 files and they ... can seamlessly work into the main theme every few play throughs ... it's only 3 files, a
3 min theme, and 2 short piano inserts"). OGG and MP3, in handoff.py's form, with a manifest (town.json).
  python3 town.py [--stereo] [--kbps N] <out folder>      (the game's files are --stereo --kbps 192)

The pieces fit like a boss theme's intro and loop do. The loop file has PAD seconds of its end before it and PAD of its
start after it, and is looped between PAD and PAD + loopSeconds. A solo file is the solo's twenty bars and then four
seconds of what it leaves ringing (faded at the end). To play a solo: when a pass of the loop ends, don't start the
next pass; start the solo there; and `seconds` after the solo started, start the loop again from its top (offset PAD)
while the solo's file plays out over it. A solo's start already has what the theme's last bars leave ringing.
All three share one gain: the theme's (about -16 LUFS), so a solo is as much quieter than the theme as it was written.
"""
import json
import subprocess
import sys
import tempfile

import numpy as np

import handoff
import master
import song_ad
from handoff import HEADROOM, PAD, TAIL, ceiling, fold, save
from phases_v import level
from synth import SR


def main(out: str) -> None:
    theme = fold(song_ad.render())
    n_solo = int(round(song_ad.SOLO_BARS * 4 * 60 / song_ad.BPM * SR))
    keep, fade = n_solo + int(TAIL * SR), int(0.5 * SR)
    solos = {}
    for name in song_ad.SOLOS:
        x = fold(song_ad.piece(name))[:, :keep]
        x[:, -fade:] *= np.linspace(1, 0, fade)
        solos[name] = x
    with tempfile.TemporaryDirectory() as tmp:
        wav = f"{tmp}/x.wav"
        g = level(theme, master.TARGET, wav)

        def joined(x):
            """A solo and the theme's start under its ringing, as heard: for the peak there."""
            y = ceiling(x * g)
            y[:, n_solo:] += ceiling(theme[:, : keep - n_solo] * g)
            return y

        # (A little down, towards the handoff's headroom: an encoder's overshoot then stays under full scale.)
        g *= min(1.0, HEADROOM / max(float(np.max(np.abs(y))) for y in (ceiling(theme * g), *(joined(x) for x in solos.values()))))
        pad = int(PAD * SR)
        loop = ceiling(theme * g)
        files = {"town-loop": np.concatenate([loop[:, -pad:], loop, loop[:, :pad]], axis=1), **{f"town-solo-{name}": ceiling(x * g) for name, x in solos.items()}}
        for name, x in files.items():
            save(wav, x[:1] if handoff.MONO else x)
            for ext, codec in (("ogg", ["-c:a", "libvorbis", "-q:a", "3"]), ("mp3", handoff.MP3)):
                subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", wav, *codec, f"{out}/{name}.{ext}"], check=True)
        save(wav, loop)
        manifest = {
            "pad": PAD,
            "note": ("Loop <loop> between pad and pad + loopSeconds. To play a solo: when a pass of the loop ends, start the solo's file there instead of "
                     "the next pass; `seconds` after the solo started, start the loop again from its top (offset pad) and let the solo's file play out over it."),
            "source": "scripts/reel/music/song_ad.py",
            "theme": {"loop": "town-loop", "loopSeconds": round(theme.shape[1] / SR, 6), "bpm": song_ad.BPM, "lufs": round(master.lufs(wav), 1),
                      "peakDb": round(float(20 * np.log10(np.max(np.abs(loop)))), 1)},
            "solos": [{"id": name, "file": f"town-solo-{name}", "seconds": round(n_solo / SR, 6), "fileSeconds": round(keep / SR, 6),
                       "peakDb": round(float(20 * np.log10(np.max(np.abs(joined(x))))), 1)} for name, x in solos.items()],
        }
    with open(f"{out}/town.json", "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main(*handoff.options(sys.argv[1:]))
