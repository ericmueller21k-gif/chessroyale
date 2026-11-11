#!/usr/bin/env bash
# Builds everything in this folder: both tracks for the phone reel (25.3 s) and for the wide reel (25.4333 s: the same
# notes a hair slower), mastered, encoded, and muxed onto the reels to watch with sound.
#   src/build.sh <hunchess-reel.mp4> <hunchess-reel-wide.mp4>      (needs python3 + numpy, ffmpeg, fluidsynth, FluidR3_GM.sf2)
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=$here/..
tmp=$(mktemp -d)
for v in phone:25.3:"$1" wide:25.433333:"$2"; do
  IFS=: read -r kind secs reel <<<"$v"
  sfx=""; [ "$kind" = wide ] && sfx="-wide"
  python3 "$here/chip.py" "$tmp/chip$sfx.wav" "$secs"
  python3 "$here/orch.py" "$tmp/orch$sfx.wav" "$secs"
  [ "$kind" = phone ] && cp "$tmp/orch.mid" "$out/reel-orchestra.mid"
  for t in chiptune:chip orchestra:orch; do
    name=$out/reel-${t%%:*}$sfx
    python3 "$here/master.py" "$tmp/${t##*:}$sfx.wav" "$tmp/m.wav"
    ffmpeg -hide_banner -v error -y -i "$tmp/m.wav" -c:a libvorbis -q:a 5 "$name.ogg"
    ffmpeg -hide_banner -v error -y -i "$tmp/m.wav" -c:a libmp3lame -q:a 3 "$name.mp3"
    ffmpeg -hide_banner -v error -y -i "$reel" -i "$tmp/m.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$name-with-reel.mp4"
    cp "$tmp/m.wav" "$tmp/${t%%:*}$sfx-master.wav"
  done
done
python3 "$here/levels.py" "$tmp"/*-master.wav
echo "masters (wav) left in $tmp"
