#!/usr/bin/env bash
# Renders and masters the trailer soundtracks (A and B on the trailer's cut; C, a 30 s loop) (about -16 LUFS, a soft ceiling at -1 dBFS) and encodes them:
# <out>/track-{A,B,C}.{wav,ogg,mp3}. Needs python3 with numpy, and ffmpeg.
#   scripts/reel/music/build.sh [out folder: reports/trailer]
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=${1:-$here/../../../reports/trailer}
mkdir -p "$out"
tmp=$(mktemp -d)
cd "$here"
for t in A:track_a B:track_b C:song_c; do
  python3 "${t##*:}.py" "$tmp/raw.wav"
  python3 master.py "$tmp/raw.wav" "$out/track-${t%%:*}.wav"
  ffmpeg -hide_banner -v error -y -i "$out/track-${t%%:*}.wav" -c:a libvorbis -q:a 6 "$out/track-${t%%:*}.ogg"
  ffmpeg -hide_banner -v error -y -i "$out/track-${t%%:*}.wav" -c:a libmp3lame -q:a 2 "$out/track-${t%%:*}.mp3"
done
python3 levels.py "$out"/track-A.wav "$out"/track-B.wav "$out"/track-C.wav:1.5
