#!/usr/bin/env bash
# Renders and masters the trailer soundtracks (A and B on the trailer's cut; C to Y, loops of 30 s to four minutes) (about -16 LUFS, a soft ceiling at -1 dBFS) and encodes them:
# <out>/track-{A..Y}.{wav,ogg,mp3}. Needs python3 with numpy, and ffmpeg.
#   scripts/reel/music/build.sh [out folder: reports/trailer]
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=${1:-$here/../../../reports/trailer}
mkdir -p "$out"
tmp=$(mktemp -d)
cd "$here"
for t in A:track_a B:track_b C:song_c D:song_d E:song_e F:song_f G:song_g H:song_h I:song_i J:song_j K:song_k L:song_l M:song_m N:song_n O:song_o P:song_p Q:song_q R:song_r S:song_s T:song_t U:song_u V:song_v W:song_w X:song_x Y:song_y Z:song_z AA:song_aa; do
  python3 "${t##*:}.py" "$tmp/raw.wav"
  python3 master.py "$tmp/raw.wav" "$out/track-${t%%:*}.wav"
  ffmpeg -hide_banner -v error -y -i "$out/track-${t%%:*}.wav" -c:a libvorbis -q:a 6 "$out/track-${t%%:*}.ogg"
  ffmpeg -hide_banner -v error -y -i "$out/track-${t%%:*}.wav" -c:a libmp3lame -q:a 2 "$out/track-${t%%:*}.mp3"
done
python3 levels.py "$out"/track-A.wav "$out"/track-B.wav "$out"/track-C.wav:1.5 "$out"/track-D.wav:1.875 "$out"/track-E.wav:1.6667 "$out"/track-F.wav:1.5 "$out"/track-G.wav:1.5 "$out"/track-H.wav:2.5 "$out"/track-I.wav:2.1429 "$out"/track-J.wav:1.7647 "$out"/track-K.wav:5.4545 "$out"/track-L.wav:6 "$out"/track-M.wav:6.6667 "$out"/track-N.wav:6.857 "$out"/track-O.wav:5.4545 "$out"/track-P.wav:10.909 "$out"/track-Q.wav:10.909 "$out"/track-R.wav:7.0588 "$out"/track-S.wav:2 "$out"/track-T.wav:2 "$out"/track-U.wav:2 "$out"/track-V.wav:2 "$out"/track-W.wav:3.75 "$out"/track-X.wav:1.9 "$out"/track-Y.wav:1.9 "$out"/track-Z.wav:2.3077 "$out"/track-AA.wav:1.9
