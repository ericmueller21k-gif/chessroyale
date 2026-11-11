#!/usr/bin/env bash
# Cuts the landing page's demo reel out of the scenes scripts/reel/record-reel.ts recorded (reports/demo/<scene>/) and encodes it
# small for phones: H.264 MP4, VP9 WebM and a poster frame (packages/app/public/media/hunchess-reel.*). Four scenes, each with its
# caption (reports/demo/captions/), joined by short crossfades; scene 2's parts by cuts. Each clip: scene, start, end (seconds of
# its recording), speed. Retune a cut here after a new recording (its marks.json says when each moment happened).
#   scripts/encode-demo.sh
set -euo pipefail
cd "$(dirname "$0")/../reports/demo"
OUT=../../packages/app/public/media
SEG=segments
mkdir -p "$OUT" "$SEG"
# 860 × 1544: a phone's full width at 2x, half of a tall window on a computer (the recordings are 975 × 1750).
W=860
H=1544
FADE=0.35
# The caption's bottom edge (px of the frame): near the bottom, over the lists and the floor.
CAP_BOTTOM=1478

# clip <name> <scene> <start> <end> <speed>: one cut, 30 fps, the reel's size, near-lossless (re-encoded once more at the end).
clip() {
  ffmpeg -y -v error -f concat -safe 0 -i "$2/frames.txt" \
    -vf "trim=start=$3:end=$4,setpts=(PTS-STARTPTS)/$5,fps=30,scale=$W:$H:flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset fast -crf 10 -an "$SEG/$1.mp4"
}
# captioned <out> <caption png> <in>...: the clips joined by cuts, the caption over them (fading in as they start).
captioned() {
  local out=$1 cap=$2
  shift 2
  local inputs=() chain="" n=0
  for f in "$@"; do
    inputs+=(-i "$SEG/$f.mp4")
    chain+="[$n:v]"
    n=$((n + 1))
  done
  ffmpeg -y -v error "${inputs[@]}" -loop 1 -i "captions/$cap.png" -filter_complex \
    "${chain}concat=n=$n:v=1:a=0[v];[$n:v]format=rgba,fade=in:st=0.15:d=0.3:alpha=1[c];[v][c]overlay=x=(W-w)/2:y=$CAP_BOTTOM-h:shortest=1,format=yuv420p[o]" \
    -map "[o]" -c:v libx264 -preset fast -crf 10 -an "$SEG/$out.mp4"
}
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$SEG/$1.mp4"; }

# 1. 50 v 50: your pick, the team's picks coming in, the reveal, the move played.
clip crowd crowd 5.4 9.0 1
# 2. The town: running round the park (recorded on a half-speed clock: played at 2x); Big Boy's card; his Crib, his blocks, his
#    swirl (fast); the battle loading (fast), then "A boss appears: Big Boy".
clip park town 1.2 7.4 2
clip card town 12.2 13.2 1
clip crib town 18.3 26.8 3
clip battle town 26.6 29.1 2.5
clip boss town 29.1 30.5 1
# 3. Ranked 1 v 1: the stage (both ranks), the opening on the clocks; then the run up the ranks to Transcendent.
clip versus ranked 1.7 2.8 1
clip duel ranked 11.0 16.0 1.25
clip ranks ranks 0.0 3.6 1
# 4. The Hidden Boss: his breath and his eye's glint; the end fades to black, and the loop starts again.
clip hidden hidden 0.5 5.3 1

captioned s1 c1 crowd
captioned s2a c2 park
captioned s2b c3 card crib battle boss
captioned s3a c4 versus duel
captioned s3b c6 ranks
captioned s4 c5 hidden

# Scenes 2's and 3's two parts by a cut; then the four scenes by crossfades, and a fade to black at the very end.
for n in 2 3; do
  ffmpeg -y -v error -i "$SEG/s${n}a.mp4" -i "$SEG/s${n}b.mp4" -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[o]" -map "[o]" -c:v libx264 -preset fast -crf 10 "$SEG/s$n.mp4"
done
d1=$(dur s1)
d2=$(dur s2)
d3=$(dur s3)
d4=$(dur s4)
o1=$(echo "$d1 - $FADE" | bc -l)
o2=$(echo "$o1 + $d2 - $FADE" | bc -l)
o3=$(echo "$o2 + $d3 - $FADE" | bc -l)
total=$(echo "$o3 + $d4" | bc -l)
end=$(echo "$total - 0.4" | bc -l)
JOIN="[0:v][1:v]xfade=transition=fade:duration=$FADE:offset=$o1[a];[a][2:v]xfade=transition=fade:duration=$FADE:offset=$o2[b];[b][3:v]xfade=transition=fade:duration=$FADE:offset=$o3,fade=out:st=$end:d=0.4,format=yuv420p[o]"
IN=(-i "$SEG/s1.mp4" -i "$SEG/s2.mp4" -i "$SEG/s3.mp4" -i "$SEG/s4.mp4")
ffmpeg -y -v error "${IN[@]}" -filter_complex "$JOIN" -map "[o]" -c:v libx264 -preset slow -crf 33 -profile:v high -movflags +faststart -an "$OUT/hunchess-reel.mp4"
# WebM (VP9) too, for browsers without H.264.
ffmpeg -y -v error "${IN[@]}" -filter_complex "$JOIN" -map "[o]" -c:v libvpx-vp9 -b:v 0 -crf 49 -row-mt 1 -an "$OUT/hunchess-reel.webm"
# The poster: scene 1 as the reel opens (its caption in).
ffmpeg -y -v error -ss 0.5 -i "$OUT/hunchess-reel.mp4" -frames:v 1 -q:v 4 "$OUT/hunchess-reel.jpg"
echo "reel: $total s"
ls -la "$OUT"
