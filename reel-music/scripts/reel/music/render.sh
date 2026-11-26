#!/usr/bin/env bash
# Renders both reel tracks for one reel and masters them (see NOTES.md on branch stills/reel-music).
#   scripts/reel/music/render.sh <out dir> <reel.mp4> [phone|wide]
# Needs: node (npx tsx), python3 with numpy + scipy, ffmpeg (libvorbis, libmp3lame), fluidsynth and the FluidR3 GM soundfont
# (Debian/Ubuntu: apt-get install fluidsynth fluid-soundfont-gm; or SOUNDFONT=<path to FluidR3_GM.sf2>).
set -euo pipefail
OUT=$(realpath "$1")
REEL=$(realpath "$2")
CUE=${3:-phone}
HERE=$(dirname "$(realpath "$0")")
cd "$HERE/../../.."
LEN=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$REEL")
SUF=$([ "$CUE" = wide ] && echo -wide || true)
mkdir -p "$OUT"
npx tsx scripts/reel/music/chiptune.ts "$OUT" "$CUE"
npx tsx scripts/reel/music/orchestra.ts "$OUT" "$CUE"
cd "$OUT"
python3 "$HERE/master.py" "chiptune-$CUE-raw.wav" "$LEN" "hunchess-reel$SUF-chiptune" "$REEL"
python3 "$HERE/master.py" "orchestra-$CUE-raw.wav" "$LEN" "hunchess-reel$SUF-orchestra" "$REEL"
