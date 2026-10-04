#!/usr/bin/env bash
# Cuts the landing page's demo loop out of a recording (scripts/record-demo.ts)
# and encodes it small for phones: H.264 MP4, VP9 WebM and a poster frame.
#   scripts/encode-demo.sh <start-seconds> [length-seconds]
set -euo pipefail
cd "$(dirname "$0")/../reports/demo"
START=${1:?start seconds}
LEN=${2:-24}
OUT=../../packages/app/public/media
mkdir -p "$OUT"
# Top 700 CSS px of the phone screen (header, board, live picks, top of the table), 600 px wide.
ffmpeg -y -v error -f concat -safe 0 -i frames.txt -ss "$START" -t "$LEN" \
  -vf "fps=30,crop=780:1400:0:0,scale=600:-2,format=yuv420p" \
  -c:v libx264 -preset slow -crf 27 -profile:v high -movflags +faststart -an "$OUT/crowd-demo.mp4"
# WebM (VP9) too, for browsers without H.264.
ffmpeg -y -v error -f concat -safe 0 -i frames.txt -ss "$START" -t "$LEN" \
  -vf "fps=30,crop=780:1400:0:0,scale=600:-2,format=yuv420p" \
  -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -an "$OUT/crowd-demo.webm"
ffmpeg -y -v error -ss 0.5 -i "$OUT/crowd-demo.mp4" -frames:v 1 -q:v 4 "$OUT/crowd-demo.jpg"
ls -la "$OUT"
